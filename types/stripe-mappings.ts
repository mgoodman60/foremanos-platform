/**
 * Type mappings for Stripe → Prisma conversions.
 * Used to ensure type safety in webhook handlers.
 */

import type Stripe from 'stripe';
import { SubscriptionStatus, SubscriptionTier } from '@prisma/client';

/**
 * Maps Stripe subscription status to Prisma SubscriptionStatus enum.
 * Handles all Stripe status values with fallback to 'incomplete'.
 */
export function mapStripeStatusToPrisma(
  status: Stripe.Subscription.Status
): SubscriptionStatus {
  const mapping: Record<Stripe.Subscription.Status, SubscriptionStatus> = {
    active: 'active',
    canceled: 'canceled',
    incomplete: 'incomplete',
    incomplete_expired: 'incomplete_expired',
    past_due: 'past_due',
    paused: 'incomplete', // Prisma doesn't have 'paused', map to incomplete
    trialing: 'trialing',
    unpaid: 'unpaid',
  };
  return mapping[status] ?? 'incomplete';
}

/**
 * Price ID to tier mapping.
 * Should match the STRIPE_PRICE_IDS in lib/stripe.ts.
 */
export const PRICE_ID_TO_TIER: Record<string, SubscriptionTier> = {
  // These should be replaced with actual Stripe Price IDs
  'price_starter': 'starter',
  'price_pro': 'pro',
  'price_team': 'team',
  'price_business': 'business',
  'price_enterprise': 'enterprise',
};

/**
 * Gets subscription tier from Stripe price ID.
 * Falls back to 'free' if price ID not recognized.
 */
export function getTierFromPriceId(priceId: string | undefined): SubscriptionTier {
  if (!priceId) return 'free';
  return PRICE_ID_TO_TIER[priceId] ?? 'free';
}

/**
 * Stripe subscription data that we extract for database storage.
 * These fields exist on Stripe.Subscription but are typed as numbers (Unix timestamps).
 */
export interface StripeSubscriptionDates {
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
}

/**
 * Extracts date fields from a Stripe subscription.
 * Converts Unix timestamps to JavaScript Date objects.
 */
export function extractSubscriptionDates(
  subscription: Stripe.Subscription
): StripeSubscriptionDates {
  // Access fields via type assertion as they're expandable in Stripe API
  const sub = subscription as unknown as {
    current_period_start: number;
    current_period_end: number;
    cancel_at_period_end: boolean;
  };
  return {
    currentPeriodStart: new Date(sub.current_period_start * 1000),
    currentPeriodEnd: new Date(sub.current_period_end * 1000),
    cancelAtPeriodEnd: sub.cancel_at_period_end,
  };
}

/**
 * Type guard to check if an error is a Stripe error.
 */
export function isStripeError(error: unknown): error is Stripe.errors.StripeError {
  return (
    error !== null &&
    typeof error === 'object' &&
    'type' in error &&
    typeof (error as { type: unknown }).type === 'string'
  );
}

/**
 * Safely extracts error message from unknown error.
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (isStripeError(error)) {
    return error.message;
  }
  return String(error);
}
