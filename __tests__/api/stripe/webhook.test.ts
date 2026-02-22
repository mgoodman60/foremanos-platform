import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  prismaMock,
  constructEventMock,
  subscriptionsRetrieveMock,
  headersMock,
  mockStripeSubscription,
} from '../../mocks/shared-mocks';
import {
  createMockStripeEvent,
  createMockCheckoutSession,
  createMockStripeSubscription,
  createMockStripeInvoice,
  createMockPrismaUser,
} from '../../helpers/test-utils';
import { POST } from '@/app/api/stripe/webhook/route';
import { NextRequest } from 'next/server';

// Helper to create webhook request
function createWebhookRequest(body: string, signature?: string): NextRequest {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (signature) {
    headers['stripe-signature'] = signature;
  }
  return new NextRequest('http://localhost/api/stripe/webhook', {
    method: 'POST',
    body,
    headers,
  });
}

describe('Stripe Webhook Route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset default mock values
    prismaMock.user.findFirst.mockResolvedValue(createMockPrismaUser());
    prismaMock.user.update.mockResolvedValue(createMockPrismaUser());
    prismaMock.paymentHistory.create.mockResolvedValue({ id: 'payment-1' });
    subscriptionsRetrieveMock.mockResolvedValue(mockStripeSubscription);
  });

  // ============================================
  // Authentication & Validation Tests (3 tests)
  // ============================================
  describe('Authentication & Validation', () => {
    it('should return 400 when signature header is missing', async () => {
      // Mock headers to return null for stripe-signature
      headersMock.mockResolvedValue({
        get: vi.fn().mockReturnValue(null),
      });

      const request = createWebhookRequest('{}');
      const response = await POST(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('No signature');
    });

    it('should return 400 when signature verification fails', async () => {
      headersMock.mockResolvedValue({
        get: vi.fn().mockReturnValue('invalid_signature'),
      });

      constructEventMock.mockImplementation(() => {
        throw new Error('Invalid signature');
      });

      const request = createWebhookRequest('{}');
      const response = await POST(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('Webhook Error');
    });

    it('should return 200 for valid signature (happy path)', async () => {
      headersMock.mockResolvedValue({
        get: vi.fn().mockReturnValue('valid_signature'),
      });

      const event = createMockStripeEvent('customer.subscription.updated', mockStripeSubscription);
      constructEventMock.mockReturnValue(event);

      const request = createWebhookRequest(JSON.stringify(event));
      const response = await POST(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.received).toBe(true);
    });
  });

  // ============================================
  // checkout.session.completed Tests (4 tests)
  // ============================================
  describe('checkout.session.completed', () => {
    it('should update user subscription on successful checkout', async () => {
      headersMock.mockResolvedValue({
        get: vi.fn().mockReturnValue('valid_signature'),
      });

      const session = createMockCheckoutSession();
      const event = createMockStripeEvent('checkout.session.completed', session);
      constructEventMock.mockReturnValue(event);

      const request = createWebhookRequest(JSON.stringify(event));
      const response = await POST(request);

      expect(response.status).toBe(200);
      expect(prismaMock.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'user-1' },
          data: expect.objectContaining({
            stripeCustomerId: 'cus_test123',
            stripeSubscriptionId: 'sub_test123',
          }),
        })
      );
    });

    it('should auto-approve account and set role to client', async () => {
      headersMock.mockResolvedValue({
        get: vi.fn().mockReturnValue('valid_signature'),
      });

      const session = createMockCheckoutSession();
      const event = createMockStripeEvent('checkout.session.completed', session);
      constructEventMock.mockReturnValue(event);

      const request = createWebhookRequest(JSON.stringify(event));
      await POST(request);

      expect(prismaMock.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            approved: true,
            role: 'client',
            emailVerified: true,
          }),
        })
      );
    });

    it('should handle missing userId in metadata gracefully', async () => {
      headersMock.mockResolvedValue({
        get: vi.fn().mockReturnValue('valid_signature'),
      });

      const session = createMockCheckoutSession({
        metadata: {},
        client_reference_id: null as any,
      });
      const event = createMockStripeEvent('checkout.session.completed', session);
      constructEventMock.mockReturnValue(event);

      const request = createWebhookRequest(JSON.stringify(event));
      const response = await POST(request);

      // Should still return 200 but not update user
      expect(response.status).toBe(200);
      expect(prismaMock.user.update).not.toHaveBeenCalled();
    });

    it('should map priceId to correct subscription tier', async () => {
      headersMock.mockResolvedValue({
        get: vi.fn().mockReturnValue('valid_signature'),
      });

      // Test different price IDs
      const priceIds = [
        { id: 'price_starter_monthly', expectedTier: 'starter' },
        { id: 'price_pro_monthly', expectedTier: 'pro' },
        { id: 'price_team_monthly', expectedTier: 'team' },
        { id: 'price_business_annual', expectedTier: 'business' },
        { id: 'price_enterprise_custom', expectedTier: 'enterprise' },
        { id: 'price_unknown_custom', expectedTier: 'free' },
      ];

      for (const { id, expectedTier } of priceIds) {
        vi.clearAllMocks();

        const subscription = createMockStripeSubscription({ priceId: id });
        subscriptionsRetrieveMock.mockResolvedValue(subscription);

        const session = createMockCheckoutSession();
        const event = createMockStripeEvent('checkout.session.completed', session);
        constructEventMock.mockReturnValue(event);

        const request = createWebhookRequest(JSON.stringify(event));
        await POST(request);

        expect(prismaMock.user.update).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              subscriptionTier: expectedTier,
            }),
          })
        );
      }
    });
  });

  // ============================================
  // customer.subscription.updated Tests (3 tests)
  // ============================================
  describe('customer.subscription.updated', () => {
    it('should update subscription tier on plan change', async () => {
      headersMock.mockResolvedValue({
        get: vi.fn().mockReturnValue('valid_signature'),
      });

      const subscription = createMockStripeSubscription({ priceId: 'price_team_monthly' });
      const event = createMockStripeEvent('customer.subscription.updated', subscription);
      constructEventMock.mockReturnValue(event);

      const request = createWebhookRequest(JSON.stringify(event));
      const response = await POST(request);

      expect(response.status).toBe(200);
      expect(prismaMock.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            subscriptionTier: 'team',
          }),
        })
      );
    });

    it('should fall back to customer lookup when metadata is missing', async () => {
      headersMock.mockResolvedValue({
        get: vi.fn().mockReturnValue('valid_signature'),
      });

      const subscription = createMockStripeSubscription();
      subscription.metadata = {}; // No userId in metadata
      const event = createMockStripeEvent('customer.subscription.updated', subscription);
      constructEventMock.mockReturnValue(event);

      const foundUser = createMockPrismaUser({ id: 'user-from-customer' });
      prismaMock.user.findFirst.mockResolvedValue(foundUser);

      const request = createWebhookRequest(JSON.stringify(event));
      const response = await POST(request);

      expect(response.status).toBe(200);
      expect(prismaMock.user.findFirst).toHaveBeenCalledWith({
        where: { stripeCustomerId: 'cus_test123' },
      });
      expect(prismaMock.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'user-from-customer' },
        })
      );
    });

    it('should update billing period dates correctly', async () => {
      headersMock.mockResolvedValue({
        get: vi.fn().mockReturnValue('valid_signature'),
      });

      const now = Math.floor(Date.now() / 1000);
      const periodEnd = now + 30 * 24 * 60 * 60;

      const subscription = createMockStripeSubscription({
        current_period_start: now,
        current_period_end: periodEnd,
      });
      const event = createMockStripeEvent('customer.subscription.updated', subscription);
      constructEventMock.mockReturnValue(event);

      const request = createWebhookRequest(JSON.stringify(event));
      await POST(request);

      expect(prismaMock.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            subscriptionStart: new Date(now * 1000),
            subscriptionEnd: new Date(periodEnd * 1000),
          }),
        })
      );
    });
  });

  // ============================================
  // customer.subscription.deleted Tests (2 tests)
  // ============================================
  describe('customer.subscription.deleted', () => {
    it('should downgrade user to free tier on cancellation', async () => {
      headersMock.mockResolvedValue({
        get: vi.fn().mockReturnValue('valid_signature'),
      });

      const subscription = createMockStripeSubscription();
      const event = createMockStripeEvent('customer.subscription.deleted', subscription);
      constructEventMock.mockReturnValue(event);

      const request = createWebhookRequest(JSON.stringify(event));
      const response = await POST(request);

      expect(response.status).toBe(200);
      expect(prismaMock.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            subscriptionTier: 'free',
          }),
        })
      );
    });

    it('should set subscription status to canceled', async () => {
      headersMock.mockResolvedValue({
        get: vi.fn().mockReturnValue('valid_signature'),
      });

      const subscription = createMockStripeSubscription();
      const event = createMockStripeEvent('customer.subscription.deleted', subscription);
      constructEventMock.mockReturnValue(event);

      const request = createWebhookRequest(JSON.stringify(event));
      await POST(request);

      expect(prismaMock.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            subscriptionStatus: 'canceled',
            cancelAtPeriodEnd: false,
          }),
        })
      );
    });
  });

  // ============================================
  // Invoice Events Tests (3 tests)
  // ============================================
  describe('Invoice Events', () => {
    it('should update subscription on invoice.paid', async () => {
      headersMock.mockResolvedValue({
        get: vi.fn().mockReturnValue('valid_signature'),
      });

      const invoice = createMockStripeInvoice();
      const event = createMockStripeEvent('invoice.paid', invoice);
      constructEventMock.mockReturnValue(event);

      const request = createWebhookRequest(JSON.stringify(event));
      const response = await POST(request);

      expect(response.status).toBe(200);
      expect(subscriptionsRetrieveMock).toHaveBeenCalledWith('sub_test123');
    });

    it('should set status to past_due on invoice.payment_failed', async () => {
      headersMock.mockResolvedValue({
        get: vi.fn().mockReturnValue('valid_signature'),
      });

      const invoice = createMockStripeInvoice({ status: 'open' });
      const event = createMockStripeEvent('invoice.payment_failed', invoice);
      constructEventMock.mockReturnValue(event);

      const request = createWebhookRequest(JSON.stringify(event));
      const response = await POST(request);

      expect(response.status).toBe(200);
      expect(prismaMock.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            subscriptionStatus: 'past_due',
          }),
        })
      );
    });

    it('should create PaymentHistory record for all events', async () => {
      headersMock.mockResolvedValue({
        get: vi.fn().mockReturnValue('valid_signature'),
      });

      const session = createMockCheckoutSession({
        amount_total: 2900,
        currency: 'usd',
      });
      const event = createMockStripeEvent('checkout.session.completed', session);
      constructEventMock.mockReturnValue(event);

      const request = createWebhookRequest(JSON.stringify(event));
      await POST(request);

      expect(prismaMock.paymentHistory.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'user-1',
            stripeEventType: 'checkout.session.completed',
            amount: 2900,
            currency: 'usd',
          }),
        })
      );
    });
  });
});
