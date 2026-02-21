import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import Stripe from 'stripe';
import { stripe, STRIPE_PRICE_IDS } from '@/lib/stripe';
import { prisma } from '@/lib/db';
import { SubscriptionTier } from '@prisma/client';
import {
  mapStripeStatusToPrisma,
  extractSubscriptionDates,
  getErrorMessage,
} from '@/types/stripe-mappings';
import { createLogger } from '@/lib/logger';

const logger = createLogger('stripe-webhook');

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
if (!webhookSecret) {
  throw new Error('STRIPE_WEBHOOK_SECRET environment variable is not set. Stripe webhooks will not function.');
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const headersList = await headers();
    const signature = headersList.get('stripe-signature');

    if (!signature) {
      logger.error('No Stripe signature found');
      return NextResponse.json(
        { error: 'No signature' },
        { status: 400 }
      );
    }

    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err: unknown) {
      const message = getErrorMessage(err);
      logger.error('Webhook signature verification failed', undefined, { message });
      return NextResponse.json(
        { error: `Webhook Error: ${message}` },
        { status: 400 }
      );
    }

    logger.info('Received webhook event', { type: event.type, eventId: event.id });

    // Check for duplicate event processing (idempotency)
    const existingEvent = await prisma.paymentHistory.findFirst({
      where: { stripeEventId: event.id }
    });
    if (existingEvent) {
      return NextResponse.json({ received: true, duplicate: true });
    }

    // Handle the event
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutSessionCompleted(session);
        break;
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionUpdate(subscription);
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionDeleted(subscription);
        break;
      }

      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice;
        await handleInvoicePaid(invoice);
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        await handleInvoicePaymentFailed(invoice);
        break;
      }

      default:
        logger.info('Unhandled event type', { type: event.type });
    }

    // Log the event to payment history
    await logPaymentEvent(event);

    return NextResponse.json({ received: true });
  } catch (error: unknown) {
    logger.error('Webhook handler error', error as Error);
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 500 }
    );
  }
}

async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
  const userId = session.metadata?.userId || session.client_reference_id;

  if (!userId) {
    logger.error('No userId found in checkout session');
    return;
  }

  // Get the subscription
  const subscriptionId = session.subscription as string;
  if (!subscriptionId) {
    logger.error('No subscription ID in checkout session');
    return;
  }

  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const priceId = subscription.items.data[0]?.price.id;

  // Determine tier from price ID
  const tier = getTierFromPriceId(priceId);

  // Update user in database - Auto-approve paid accounts
  const dates = extractSubscriptionDates(subscription);
  await prisma.user.update({
    where: { id: userId },
    data: {
      stripeCustomerId: session.customer as string,
      stripeSubscriptionId: subscriptionId,
      stripePriceId: priceId,
      subscriptionTier: tier,
      subscriptionStatus: mapStripeStatusToPrisma(subscription.status),
      subscriptionStart: dates.currentPeriodStart,
      subscriptionEnd: dates.currentPeriodEnd,
      cancelAtPeriodEnd: dates.cancelAtPeriodEnd,
      // Auto-approve account after successful payment
      approved: true,
      role: 'client',
      emailVerified: true, // Payment verification serves as email verification
      emailVerificationToken: null,
      emailVerificationExpires: null,
    },
  });

  logger.info('Subscription created and account approved', { userId, tier });
}

async function handleSubscriptionUpdate(subscription: Stripe.Subscription) {
  const userId = subscription.metadata?.userId;

  if (!userId) {
    // Try to find user by customer ID
    const user = await prisma.user.findFirst({
      where: { stripeCustomerId: subscription.customer as string },
    });

    if (!user) {
      logger.error('No user found for subscription update');
      return;
    }

    await updateUserSubscription(user.id, subscription);
  } else {
    await updateUserSubscription(userId, subscription);
  }
}

async function updateUserSubscription(userId: string, subscription: Stripe.Subscription) {
  const priceId = subscription.items.data[0]?.price.id;
  const tier = getTierFromPriceId(priceId);
  const dates = extractSubscriptionDates(subscription);

  await prisma.user.update({
    where: { id: userId },
    data: {
      stripePriceId: priceId,
      subscriptionTier: tier,
      subscriptionStatus: mapStripeStatusToPrisma(subscription.status),
      subscriptionStart: dates.currentPeriodStart,
      subscriptionEnd: dates.currentPeriodEnd,
      cancelAtPeriodEnd: dates.cancelAtPeriodEnd,
    },
  });

  logger.info('Subscription updated', { userId, tier });
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const userId = subscription.metadata?.userId;

  if (!userId) {
    // Try to find user by customer ID
    const user = await prisma.user.findFirst({
      where: { stripeCustomerId: subscription.customer as string },
    });

    if (!user) {
      logger.error('No user found for subscription deletion');
      return;
    }

    await downgradeToFree(user.id);
  } else {
    await downgradeToFree(userId);
  }
}

async function downgradeToFree(userId: string) {
  await prisma.user.update({
    where: { id: userId },
    data: {
      subscriptionTier: 'free',
      subscriptionStatus: 'canceled',
      cancelAtPeriodEnd: false,
    },
  });

  logger.info('User downgraded to free tier', { userId });
}

async function handleInvoicePaid(invoice: Stripe.Invoice) {
  // subscription is an expandable field - access via type assertion
  const sub = (invoice as unknown as { subscription?: string | { id: string } | null }).subscription;
  const subscriptionId = typeof sub === 'string' ? sub : sub?.id;

  if (!subscriptionId) {
    return;
  }

  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const userId = subscription.metadata?.userId;

  if (!userId) {
    // Try to find user by customer ID
    const user = await prisma.user.findFirst({
      where: { stripeCustomerId: invoice.customer as string },
    });

    if (!user) {
      logger.error('No user found for invoice payment');
      return;
    }

    await updateUserSubscription(user.id, subscription);
  } else {
    await updateUserSubscription(userId, subscription);
  }

  logger.info('Invoice paid', { subscriptionId });
}

async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
  // subscription is an expandable field - access via type assertion
  const sub = (invoice as unknown as { subscription?: string | { id: string } | null }).subscription;
  const subscriptionId = typeof sub === 'string' ? sub : sub?.id;

  if (!subscriptionId) {
    return;
  }

  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const userId = subscription.metadata?.userId;

  if (!userId) {
    // Try to find user by customer ID
    const user = await prisma.user.findFirst({
      where: { stripeCustomerId: invoice.customer as string },
    });

    if (!user) {
      logger.error('No user found for failed payment');
      return;
    }

    await markPaymentFailed(user.id);
  } else {
    await markPaymentFailed(userId);
  }

  logger.warn('Payment failed', { subscriptionId });
}

async function markPaymentFailed(userId: string) {
  await prisma.user.update({
    where: { id: userId },
    data: {
      subscriptionStatus: 'past_due',
    },
  });
}

async function logPaymentEvent(event: Stripe.Event) {
  try {
    // Extract user ID from event
    let userId: string | undefined;
    const eventObject = event.data.object;

    if (event.type.startsWith('checkout.session')) {
      const session = eventObject as Stripe.Checkout.Session;
      userId = session.metadata?.userId || session.client_reference_id || undefined;
    } else if (event.type.startsWith('customer.subscription')) {
      const subscription = eventObject as Stripe.Subscription;
      userId = subscription.metadata?.userId;

      if (!userId && subscription.customer) {
        const customerId = typeof subscription.customer === 'string'
          ? subscription.customer
          : subscription.customer.id;
        const user = await prisma.user.findFirst({
          where: { stripeCustomerId: customerId },
        });
        userId = user?.id;
      }
    } else if (event.type.startsWith('invoice')) {
      const invoice = eventObject as Stripe.Invoice;
      if (!userId && invoice.customer) {
        const customerId = typeof invoice.customer === 'string'
          ? invoice.customer
          : invoice.customer.id;
        const user = await prisma.user.findFirst({
          where: { stripeCustomerId: customerId },
        });
        userId = user?.id;
      }
    }

    if (!userId) {
      logger.info('No user ID found for payment event logging');
      return;
    }

    // Extract amount and currency using type narrowing
    let amount: number | null = null;
    let currency: string | null = null;

    if ('amount_total' in eventObject && eventObject.amount_total !== null) {
      amount = eventObject.amount_total as number;
      currency = ('currency' in eventObject ? eventObject.currency : null) as string | null;
    } else if ('amount_paid' in eventObject && eventObject.amount_paid !== null) {
      amount = eventObject.amount_paid as number;
      currency = ('currency' in eventObject ? eventObject.currency : null) as string | null;
    }

    await prisma.paymentHistory.create({
      data: {
        userId,
        stripeEventId: event.id,
        stripeEventType: event.type,
        amount,
        currency,
        status: 'succeeded',
        // Store the event object as JSON - Prisma handles the serialization
        metadata: JSON.parse(JSON.stringify(eventObject)),
      },
    });
  } catch (error) {
    logger.error('Error logging payment event', error as Error);
  }
}

function getTierFromPriceId(priceId: string | undefined): SubscriptionTier {
  if (!priceId) return 'free';

  // Build a reverse map from actual Stripe price IDs (env vars) to tiers
  const tierMap: Record<string, SubscriptionTier> = {
    starter_monthly: 'starter',
    starter_annual: 'starter',
    pro_monthly: 'pro',
    pro_annual: 'pro',
    team_monthly: 'team',
    business_monthly: 'business',
    enterprise_monthly: 'enterprise',
  };

  for (const [key, id] of Object.entries(STRIPE_PRICE_IDS)) {
    if (id === priceId && tierMap[key]) {
      return tierMap[key];
    }
  }

  return 'free';
}
