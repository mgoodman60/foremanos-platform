import Stripe from 'stripe';
import {
  DEFAULT_FREE_MODEL,
  DEFAULT_MODEL,
  PREMIUM_MODEL,
  SIMPLE_MODEL,
  VISION_MODEL,
  FALLBACK_MODEL,
  resolveModelAlias,
} from '@/lib/model-config';

// Lazy initialization to avoid build-time API key requirement
let stripeInstance: Stripe | null = null;

function getStripe(): Stripe {
  if (!stripeInstance) {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error('STRIPE_SECRET_KEY is not set in environment variables');
    }
    stripeInstance = new Stripe(process.env.STRIPE_SECRET_KEY, {
      // Use type assertion to handle different Stripe package versions
      apiVersion: '2024-12-18.acacia' as Stripe.LatestApiVersion,
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

// Subscription tier limits (Updated Feb 2026: Claude-primary)
export const SUBSCRIPTION_LIMITS = {
  free: {
    projects: 1,
    queriesPerMonth: 50,
    models: [DEFAULT_FREE_MODEL],
  },
  starter: {
    projects: 5,
    queriesPerMonth: 500,
    models: [DEFAULT_FREE_MODEL, DEFAULT_MODEL],
  },
  pro: {
    projects: -1, // unlimited
    queriesPerMonth: 2000,
    models: [DEFAULT_FREE_MODEL, DEFAULT_MODEL, PREMIUM_MODEL, FALLBACK_MODEL],
  },
  team: {
    projects: -1,
    queriesPerMonth: 10000,
    models: [DEFAULT_FREE_MODEL, DEFAULT_MODEL, PREMIUM_MODEL, FALLBACK_MODEL],
    teamMembers: 10,
  },
  business: {
    projects: -1,
    queriesPerMonth: 25000,
    models: [DEFAULT_FREE_MODEL, DEFAULT_MODEL, PREMIUM_MODEL, FALLBACK_MODEL],
    teamMembers: 25,
  },
  enterprise: {
    projects: -1,
    queriesPerMonth: -1, // unlimited
    models: [DEFAULT_FREE_MODEL, DEFAULT_MODEL, PREMIUM_MODEL, FALLBACK_MODEL],
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

/**
 * Check if a model is allowed for the given subscription tier.
 * Resolves legacy aliases before checking.
 */
export function isModelAllowed(tier: SubscriptionTier, model: string): boolean {
  const resolved = resolveModelAlias(model);
  const limits = SUBSCRIPTION_LIMITS[tier];
  return (limits.models as readonly string[]).includes(resolved);
}

/**
 * Get the effective model for a user's tier.
 * If the requested model isn't allowed, downgrades to the best allowed alternative.
 *
 * @param tier - User's subscription tier
 * @param requestedModel - Model selected by complexity analyzer
 * @param complexity - Query complexity level
 * @returns The model to actually use for the API call
 */
export function getEffectiveModel(
  tier: SubscriptionTier,
  requestedModel: string,
  complexity: 'simple' | 'medium' | 'complex'
): string {
  const resolved = resolveModelAlias(requestedModel);

  // If the resolved model is allowed, use it
  if (isModelAllowed(tier, resolved)) {
    return resolved;
  }

  // Downgrade logic based on tier
  const allowedModels = SUBSCRIPTION_LIMITS[tier].models as readonly string[];

  // For complex queries, try premium -> default -> simple
  if (complexity === 'complex') {
    if (allowedModels.includes(PREMIUM_MODEL)) return PREMIUM_MODEL;
    if (allowedModels.includes(DEFAULT_MODEL)) return DEFAULT_MODEL;
    if (allowedModels.includes(FALLBACK_MODEL)) return FALLBACK_MODEL;
    return DEFAULT_FREE_MODEL;
  }

  // For medium queries, try default -> simple
  if (complexity === 'medium') {
    if (allowedModels.includes(DEFAULT_MODEL)) return DEFAULT_MODEL;
    if (allowedModels.includes(FALLBACK_MODEL)) return FALLBACK_MODEL;
    return DEFAULT_FREE_MODEL;
  }

  // For simple queries, use the cheapest allowed model
  return DEFAULT_FREE_MODEL;
}
