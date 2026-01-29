import Stripe from 'stripe';

// Lazy initialization to avoid build-time API key requirement
let stripeInstance: Stripe | null = null;

function getStripe(): Stripe {
  if (!stripeInstance) {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error('STRIPE_SECRET_KEY is not set in environment variables');
    }
    stripeInstance = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2025-12-15.clover',
      typescript: true,
    });
  }
  return stripeInstance;
}

// Export a proxy object that lazily initializes stripe
export const stripe = {
  get checkout() { return getStripe().checkout; },
  get billingPortal() { return getStripe().billingPortal; },
  get subscriptions() { return getStripe().subscriptions; },
  get webhooks() { return getStripe().webhooks; },
  get customers() { return getStripe().customers; },
};

// Subscription tier to Stripe price ID mapping
// TODO: Replace these with your actual Stripe Price IDs after creating products in Stripe Dashboard
export const STRIPE_PRICE_IDS = {
  starter_monthly: process.env.STRIPE_PRICE_STARTER_MONTHLY || 'price_starter_monthly',
  starter_annual: process.env.STRIPE_PRICE_STARTER_ANNUAL || 'price_starter_annual',
  pro_monthly: process.env.STRIPE_PRICE_PRO_MONTHLY || 'price_pro_monthly',
  pro_annual: process.env.STRIPE_PRICE_PRO_ANNUAL || 'price_pro_annual',
  team_monthly: process.env.STRIPE_PRICE_TEAM_MONTHLY || 'price_team_monthly',
  business_monthly: process.env.STRIPE_PRICE_BUSINESS_MONTHLY || 'price_business_monthly',
  enterprise_monthly: process.env.STRIPE_PRICE_ENTERPRISE_MONTHLY || 'price_enterprise_monthly',
} as const;

// Subscription tier limits
export const SUBSCRIPTION_LIMITS = {
  free: {
    projects: 1,
    queriesPerMonth: 50,
    models: ['gpt-3.5-turbo'],
  },
  starter: {
    projects: 5,
    queriesPerMonth: 500,
    models: ['gpt-3.5-turbo', 'claude-3-5-sonnet-20241022'],
  },
  pro: {
    projects: -1, // unlimited
    queriesPerMonth: 2000,
    models: ['gpt-3.5-turbo', 'claude-3-5-sonnet-20241022', 'gpt-4o'],
  },
  team: {
    projects: -1,
    queriesPerMonth: 10000,
    models: ['gpt-3.5-turbo', 'claude-3-5-sonnet-20241022', 'gpt-4o'],
    teamMembers: 10,
  },
  business: {
    projects: -1,
    queriesPerMonth: 25000,
    models: ['gpt-3.5-turbo', 'claude-3-5-sonnet-20241022', 'gpt-4o'],
    teamMembers: 25,
  },
  enterprise: {
    projects: -1,
    queriesPerMonth: -1, // unlimited
    models: ['gpt-3.5-turbo', 'claude-3-5-sonnet-20241022', 'gpt-4o'],
    teamMembers: -1, // unlimited
  },
} as const;

export type SubscriptionTier = keyof typeof SUBSCRIPTION_LIMITS;

/**
 * Create a Stripe Checkout Session for subscription
 */
export async function createCheckoutSession({
  userId,
  userEmail,
  priceId,
  successUrl,
  cancelUrl,
}: {
  userId: string;
  userEmail: string;
  priceId: string;
  successUrl: string;
  cancelUrl: string;
}) {
  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: successUrl,
      cancel_url: cancelUrl,
      customer_email: userEmail,
      client_reference_id: userId,
      metadata: {
        userId,
      },
      subscription_data: {
        metadata: {
          userId,
        },
      },
      allow_promotion_codes: true,
    });

    return session;
  } catch (error) {
    console.error('Error creating checkout session:', error);
    throw error;
  }
}

/**
 * Create a Stripe Customer Portal session for managing subscriptions
 */
export async function createPortalSession({
  customerId,
  returnUrl,
}: {
  customerId: string;
  returnUrl: string;
}) {
  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    });

    return session;
  } catch (error) {
    console.error('Error creating portal session:', error);
    throw error;
  }
}

/**
 * Get subscription details from Stripe
 */
export async function getSubscription(subscriptionId: string) {
  try {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    return subscription;
  } catch (error) {
    console.error('Error retrieving subscription:', error);
    throw error;
  }
}

/**
 * Cancel a subscription
 */
export async function cancelSubscription(subscriptionId: string) {
  try {
    const subscription = await stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: true,
    });
    return subscription;
  } catch (error) {
    console.error('Error canceling subscription:', error);
    throw error;
  }
}

/**
 * Reactivate a canceled subscription
 */
export async function reactivateSubscription(subscriptionId: string) {
  try {
    const subscription = await stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: false,
    });
    return subscription;
  } catch (error) {
    console.error('Error reactivating subscription:', error);
    throw error;
  }
}
