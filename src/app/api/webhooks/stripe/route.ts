import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import Stripe from 'stripe';
import { createServiceRoleClient } from '@/utils/supabase/server';
import { logger } from '@/lib/logger';
import {
  handleCheckoutSessionCompleted,
  handleSubscriptionUpdated,
  handleSubscriptionDeleted,
  handleInvoicePaymentFailed,
  handleTrialWillEnd,
} from './handlers';

export async function POST(req: Request) {
  const body = await req.text();
  const signature = (await headers()).get('Stripe-Signature') as string;

  let event: Stripe.Event;

  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    logger.error('[Webhook] STRIPE_WEBHOOK_SECRET is not configured');
    return new NextResponse('Webhook secret not configured', { status: 500 });
  }

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (error: unknown) {
    logger.error(`[Webhook] Signature Verification Failed`);
    return new NextResponse('Webhook signature verification failed', { status: 400 });
  }

  const supabase = createServiceRoleClient();

  // DB-based idempotency: claim this event atomically
  const { data: claimed, error: claimError } = await supabase.rpc('claim_webhook_event', {
    p_event_id: event.id,
  });

  if (claimError) {
    logger.error('[Webhook] Idempotency check failed');
    return new NextResponse('Idempotency check failed', { status: 500 });
  }

  if (claimed === false) {
    return new NextResponse(null, { status: 200 });
  }

  try {
      switch (event.type) {
        case 'checkout.session.completed':
          await handleCheckoutSessionCompleted(event.data.object as Stripe.Checkout.Session, supabase);
          break;
        case 'customer.subscription.updated':
          await handleSubscriptionUpdated(event.data.object as Stripe.Subscription, supabase);
          break;
        case 'customer.subscription.deleted':
          await handleSubscriptionDeleted(event.data.object as Stripe.Subscription, supabase);
          break;
        case 'invoice.payment_failed':
          await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice, supabase);
          break;
        case 'customer.subscription.trial_will_end':
          await handleTrialWillEnd(event.data.object as Stripe.Subscription, supabase);
          break;
      }
  } catch(e) {
      logger.error('[Webhook] Handler Error');
      return new NextResponse('Webhook Handler Error', { status: 500 });
  }

  return new NextResponse(null, { status: 200 });
}
