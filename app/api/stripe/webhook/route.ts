import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import Stripe from 'stripe';
import { stripe } from '@/lib/stripe';
import { prisma } from '@/lib/db';
import { SubscriptionTier } from '@prisma/client';
import {
  mapStripeStatusToPrisma,
  extractSubscriptionDates,
  getErrorMessage,
} from '@/types/stripe-mappings';

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const headersList = await headers();
    const signature = headersList.get('stripe-signature');

    if (!signature) {
      console.error('No Stripe signature found');
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
      console.error('Webhook signature verification failed:', message);
      return NextResponse.json(
        { error: `Webhook Error: ${message}` },
        { status: 400 }
      );
    }

    console.log('Received Stripe webhook event:', event.type);

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
        console.log(`Unhandled event type: ${event.type}`);
    }

    // Log the event to payment history
    await logPaymentEvent(event);

    return NextResponse.json({ received: true });
  } catch (error: unknown) {
    console.error('Webhook handler error:', getErrorMessage(error));
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 500 }
    );
  }
}

async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
  const userId = session.metadata?.userId || session.client_reference_id;

  if (!userId) {
    console.error('No userId found in checkout session');
    return;
  }

  // Get the subscription
  const subscriptionId = session.subscription as string;
  if (!subscriptionId) {
    console.error('No subscription ID in checkout session');
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

  console.log(`Subscription created and account approved for user ${userId}: ${tier}`);
}

async function handleSubscriptionUpdate(subscription: Stripe.Subscription) {
  const userId = subscription.metadata?.userId;

  if (!userId) {
    // Try to find user by customer ID
    const user = await prisma.user.findFirst({
      where: { stripeCustomerId: subscription.customer as string },
    });

    if (!user) {
      console.error('No user found for subscription update');
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

  console.log(`Subscription updated for user ${userId}: ${tier}`);
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const userId = subscription.metadata?.userId;

  if (!userId) {
    // Try to find user by customer ID
    const user = await prisma.user.findFirst({
      where: { stripeCustomerId: subscription.customer as string },
    });

    if (!user) {
      console.error('No user found for subscription deletion');
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

  console.log(`User ${userId} downgraded to free tier`);
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
      console.error('No user found for invoice payment');
      return;
    }

    await updateUserSubscription(user.id, subscription);
  } else {
    await updateUserSubscription(userId, subscription);
  }

  console.log(`Invoice paid for subscription ${subscriptionId}`);
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
      console.error('No user found for failed payment');
      return;
    }

    await markPaymentFailed(user.id);
  } else {
    await markPaymentFailed(userId);
  }

  console.log(`Payment failed for subscription ${subscriptionId}`);
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
      console.log('No user ID found for payment event logging');
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
    console.error('Error logging payment event:', error);
  }
}

function getTierFromPriceId(priceId: string | undefined): SubscriptionTier {
  if (!priceId) return 'free';

  // Map price IDs to tiers
  // This is a simple implementation - you might want to store this mapping in the database
  if (priceId.includes('starter')) return 'starter';
  if (priceId.includes('pro')) return 'pro';
  if (priceId.includes('team')) return 'team';
  if (priceId.includes('business')) return 'business';
  if (priceId.includes('enterprise')) return 'enterprise';

  // Default to free if we can't determine
  return 'free';
}
