import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import Stripe from 'stripe';
import { stripe } from '@/lib/stripe';
import { prisma } from '@/lib/db';
type SubscriptionTier = string;
type SubscriptionStatus = string;

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
    } catch (err: any) {
      console.error('Webhook signature verification failed:', err.message);
      return NextResponse.json(
        { error: `Webhook Error: ${err.message}` },
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
  } catch (error: any) {
    console.error('Webhook handler error:', error);
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
  await prisma.user.update({
    where: { id: userId },
    data: {
      stripeCustomerId: session.customer as string,
      stripeSubscriptionId: subscriptionId,
      stripePriceId: priceId,
      subscriptionTier: tier as any,
      subscriptionStatus: subscription.status as any,
      subscriptionStart: new Date((subscription as any).current_period_start * 1000),
      subscriptionEnd: new Date((subscription as any).current_period_end * 1000),
      cancelAtPeriodEnd: (subscription as any).cancel_at_period_end,
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

  await prisma.user.update({
    where: { id: userId },
    data: {
      stripePriceId: priceId,
      subscriptionTier: tier as any,
      subscriptionStatus: subscription.status as any,
      subscriptionStart: new Date((subscription as any).current_period_start * 1000),
      subscriptionEnd: new Date((subscription as any).current_period_end * 1000),
      cancelAtPeriodEnd: (subscription as any).cancel_at_period_end,
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
  const subscriptionId = (invoice as any).subscription as string;

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
  const subscriptionId = (invoice as any).subscription as string;

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

    if (event.type.startsWith('checkout.session')) {
      const session = event.data.object as Stripe.Checkout.Session;
      userId = session.metadata?.userId || session.client_reference_id || undefined;
    } else if (event.type.startsWith('customer.subscription') || event.type.startsWith('invoice')) {
      const obj = event.data.object as any;
      userId = obj.metadata?.userId;

      if (!userId && obj.customer) {
        const user = await prisma.user.findFirst({
          where: { stripeCustomerId: obj.customer as string },
        });
        userId = user?.id;
      }
    }

    if (!userId) {
      console.log('No user ID found for payment event logging');
      return;
    }

    // Extract amount and currency
    let amount: number | null = null;
    let currency: string | null = null;

    if ('amount_total' in event.data.object) {
      amount = (event.data.object as any).amount_total;
      currency = (event.data.object as any).currency;
    } else if ('amount_paid' in event.data.object) {
      amount = (event.data.object as any).amount_paid;
      currency = (event.data.object as any).currency;
    }

    await prisma.paymentHistory.create({
      data: {
        userId,
        stripeEventId: event.id,
        stripeEventType: event.type,
        amount,
        currency,
        status: 'succeeded',
        metadata: event.data.object as any,
      },
    });
  } catch (error) {
    console.error('Error logging payment event:', error);
  }
}

function getTierFromPriceId(priceId: string): SubscriptionTier {
  // Map price IDs to tiers
  // This is a simple implementation - you might want to store this mapping in the database
  if (priceId.includes('starter')) return 'starter';
  if (priceId.includes('pro')) return 'pro';
  if (priceId.includes('team')) return 'team';
  if (priceId.includes('business')) return 'business';
  if (priceId.includes('enterprise')) return 'enterprise';

  // Default to starter if we can't determine
  return 'starter';
}
