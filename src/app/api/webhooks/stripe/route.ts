import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import Stripe from 'stripe';
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js';

export async function POST(req: Request) {
  const body = await req.text();
  const signature = (await headers()).get('Stripe-Signature') as string;

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET ?? ''
    );
  } catch (error: any) {
    console.error(`[Webhook] Signature Verification Failed: ${error.message}`);
    return new NextResponse(`Webhook Error: ${error.message}`, { status: 400 });
  }

  const supabase = createClientServiceRole();

  try {
      switch (event.type) {
        case 'checkout.session.completed':
          const checkoutSession = event.data.object as Stripe.Checkout.Session;
          await handleCheckoutSessionCompleted(checkoutSession, supabase);
          break;
        case 'customer.subscription.updated':
          const subscriptionUpdated = event.data.object as Stripe.Subscription;
          await handleSubscriptionUpdated(subscriptionUpdated, supabase);
          break;
        case 'customer.subscription.deleted':
          const subscriptionDeleted = event.data.object as Stripe.Subscription;
          await handleSubscriptionDeleted(subscriptionDeleted, supabase);
          break;
      }
  } catch(e) {
      console.error('[Webhook] Handler Error:', e);
      return new NextResponse('Webhook Handler Error', { status: 500 });
  }

  return new NextResponse(null, { status: 200 });
}

// Service Role Client (Bypass RLS for Webhook updates)
function createClientServiceRole() {
    const sbUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const sbServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!sbUrl || !sbServiceKey) {
        throw new Error("Missing Supabase Environment Variables for Service Role");
    }

    return createSupabaseAdmin(sbUrl, sbServiceKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
        }
    });
}

async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session, supabase: any) {
    if(!session.subscription) {
        return;
    }

    const userId = session.client_reference_id;
    const subscriptionId = session.subscription as string;
    const customerId = session.customer as string;

    if (!userId) {
        console.error("[Webhook] Missing userId in session client_reference_id");
        return;
    }

    // Verify the user exists in profiles
    const { data: existingProfile, error: selectError } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', userId)
        .single();

    if (selectError || !existingProfile) {
        console.error(`[Webhook] User not found in profiles: ${userId}`);
        return;
    }

    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    const periodEnd = (subscription.items?.data?.[0] as any)?.current_period_end as number | undefined
      ?? (subscription as any).current_period_end as number | undefined;

    let subscriptionEndDate: string | null = null;
    if (periodEnd && typeof periodEnd === 'number') {
        subscriptionEndDate = new Date(periodEnd * 1000).toISOString();
    }

    // Determine subscription tier from the Price ID
    const EXTRA_PRICE_ID = process.env.NEXT_PUBLIC_STRIPE_EXTRA_PRICE_ID;
    const subscribedPriceId = subscription.items?.data?.[0]?.price?.id;
    const subscriptionTier = (EXTRA_PRICE_ID && subscribedPriceId === EXTRA_PRICE_ID) ? 'extra' : 'premium';

    const updateData = {
        stripe_customer_id: customerId,
        stripe_subscription_id: subscriptionId,
        subscription_status: subscription.status,
        is_premium: subscription.status === 'active' || subscription.status === 'trialing',
        subscription_tier: subscriptionTier,
        subscription_end_date: subscriptionEndDate,
        auto_renew: !subscription.cancel_at_period_end,
    };

    const { data: updatedData, error } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('id', userId)
        .select();

    if (error) {
        console.error(`[Webhook] DB Update Failed: ${error.message}`, error);
    } else if (!updatedData || updatedData.length === 0) {
        console.error(`[Webhook] DB Update returned no data - possible RLS issue`);
    }

    // Cancel old subscription if this was a plan switch
    const oldSubscriptionId = session.metadata?.oldSubscriptionId;
    if (oldSubscriptionId && oldSubscriptionId !== subscriptionId) {
        try {
            await stripe.subscriptions.cancel(oldSubscriptionId);
        } catch (cancelErr: any) {
            console.error(`[Webhook] Failed to cancel old subscription ${oldSubscriptionId}: ${cancelErr.message}`);
        }
    }
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription, supabase: any) {
    const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('stripe_customer_id', subscription.customer)
        .single();

    if(!profile) {
        console.warn(`[Webhook] No profile found for customer: ${subscription.customer}`);
        return;
    }

    const periodEnd = (subscription.items?.data?.[0] as any)?.current_period_end
      ?? (subscription as any).current_period_end;

    let endDate = null;
    if (periodEnd) {
        endDate = new Date(periodEnd * 1000).toISOString();
    }

    // Determine subscription tier from the Price ID
    const EXTRA_PRICE_ID = process.env.NEXT_PUBLIC_STRIPE_EXTRA_PRICE_ID;
    const subscribedPriceId = subscription.items?.data?.[0]?.price?.id;
    const subscriptionTier = (EXTRA_PRICE_ID && subscribedPriceId === EXTRA_PRICE_ID) ? 'extra' : 'premium';

    const updateData = {
        subscription_status: subscription.status,
        is_premium: subscription.status === 'active' || subscription.status === 'trialing',
        subscription_tier: subscriptionTier,
        subscription_end_date: endDate,
        auto_renew: !subscription.cancel_at_period_end,
    };

    const { error } = await supabase.from('profiles').update(updateData).eq('id', profile.id);

    if (error) console.error(`[Webhook] Update Failed: ${error.message}`);
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription, supabase: any) {
    const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('stripe_customer_id', subscription.customer)
        .single();

    if(!profile) return;

    await supabase.from('profiles').update({
        subscription_status: 'canceled',
        is_premium: false,
        subscription_tier: 'free',
        subscription_end_date: null,
        auto_renew: false,
    }).eq('id', profile.id);
}
