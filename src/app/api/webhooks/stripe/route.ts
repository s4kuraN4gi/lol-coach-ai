import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { createClient } from '@/utils/supabase/server';
import Stripe from 'stripe';

export async function POST(req: Request) {
  const body = await req.text();
  const signature = (await headers()).get('Stripe-Signature') as string;

  console.log(`[Webhook] Received request. Signature present: ${!!signature}`);

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

  const supabase = createClientServiceRole(); // Requires Service Role Answer for admin updates

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
        default:
          // console.log(`[Webhook] Unhandled (but received) event type: ${event.type}`);
      }
  } catch(e) {
      console.error(e);
      return new NextResponse('Webhook Handler Error', { status: 500 });
  }

  return new NextResponse(null, { status: 200 });
}

// Service Role Client (Bypass RLS for Webhook updates)
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js';

// Service Role Client (Bypass RLS for Webhook updates)
function createClientServiceRole() {
    const sbUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const sbServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    console.log(`[Webhook] Creating Service Role Client. URL present: ${!!sbUrl}, Service Key present: ${!!sbServiceKey}`);

    if (!sbUrl || !sbServiceKey) {
        console.error("[Webhook] Missing Supabase Environment Variables for Service Role");
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
    // Retrieve the subscription details
    if(!session.subscription) {
        console.log("[Webhook] No subscription in session, skipping");
        return;
    }

    // session.client_reference_id contains user.id
    const userId = session.client_reference_id;
    const subscriptionId = session.subscription as string;
    const customerId = session.customer as string;

    console.log(`[Webhook] Checkout Completed. User: ${userId}, Customer: ${customerId}, Subscription: ${subscriptionId}`);

    if (!userId) {
        console.error("[Webhook] Missing userId in session metadata/client_reference_id");
        return;
    }

    // First, verify the user exists in profiles
    const { data: existingProfile, error: selectError } = await supabase
        .from('profiles')
        .select('id, is_premium')
        .eq('id', userId)
        .single();

    if (selectError || !existingProfile) {
        console.error(`[Webhook] User not found in profiles: ${userId}, Error: ${selectError?.message}`);
        return;
    }
    console.log(`[Webhook] Found user profile: ${existingProfile.id}, current is_premium: ${existingProfile.is_premium}`);

    // We can fetch the full subscription object if we need end date immediately
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    const periodEnd = (subscription.items?.data?.[0] as any)?.current_period_end as number | undefined
      ?? (subscription as any).current_period_end as number | undefined;
    console.log(`[Webhook] Subscription status: ${subscription.status}, period_end: ${periodEnd}, cancel_at_period_end: ${subscription.cancel_at_period_end}`);

    // Handle case where period_end might be undefined
    let subscriptionEndDate: string | null = null;
    if (periodEnd && typeof periodEnd === 'number') {
        subscriptionEndDate = new Date(periodEnd * 1000).toISOString();
    } else {
        console.warn(`[Webhook] period_end is undefined or invalid, setting subscription_end_date to null`);
    }

    // Determine subscription tier from the Price ID
    const EXTRA_PRICE_ID = process.env.NEXT_PUBLIC_STRIPE_EXTRA_PRICE_ID;
    const lineItems = subscription.items?.data || [];
    const subscribedPriceId = lineItems[0]?.price?.id;
    const subscriptionTier = (EXTRA_PRICE_ID && subscribedPriceId === EXTRA_PRICE_ID) ? 'extra' : 'premium';

    console.log(`[Webhook] Determined tier: ${subscriptionTier} (priceId: ${subscribedPriceId}, extraPriceId: ${EXTRA_PRICE_ID})`);

    const updateData = {
        stripe_customer_id: customerId,
        stripe_subscription_id: subscriptionId,
        subscription_status: subscription.status,
        is_premium: subscription.status === 'active' || subscription.status === 'trialing',
        subscription_tier: subscriptionTier,
        subscription_end_date: subscriptionEndDate,
        auto_renew: !subscription.cancel_at_period_end,
    };

    console.log(`[Webhook] Updating profile with:`, JSON.stringify(updateData, null, 2));

    // Use Service Role to update with select to verify
    const { data: updatedData, error } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('id', userId)
        .select();

    if (error) {
        console.error(`[Webhook] DB Update Failed: ${error.message}`, error);
    } else if (!updatedData || updatedData.length === 0) {
        console.error(`[Webhook] DB Update returned no data - possible RLS issue or no matching row`);
    } else {
        console.log(`[Webhook] DB Updated Successfully. Updated data:`, JSON.stringify(updatedData[0], null, 2));
    }

    // Cancel old subscription if this was a plan switch
    const oldSubscriptionId = session.metadata?.oldSubscriptionId;
    if (oldSubscriptionId && oldSubscriptionId !== subscriptionId) {
        try {
            await stripe.subscriptions.cancel(oldSubscriptionId);
            console.log(`[Webhook] Cancelled old subscription: ${oldSubscriptionId}`);
        } catch (cancelErr: any) {
            console.error(`[Webhook] Failed to cancel old subscription ${oldSubscriptionId}: ${cancelErr.message}`);
        }
    }
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription, supabase: any) {
    console.log(`[Webhook] Subscription Updated: ${subscription.id}, Status: ${subscription.status}, CancelAtEnd: ${subscription.cancel_at_period_end}`);

    // Find user by stripe_customer_id
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
    console.log(`[Webhook] Period End TS: ${periodEnd}`);

    let endDate = null;
    if (periodEnd) {
        endDate = new Date(periodEnd * 1000).toISOString();
    }

    // Determine subscription tier from the Price ID
    const EXTRA_PRICE_ID = process.env.NEXT_PUBLIC_STRIPE_EXTRA_PRICE_ID;
    const lineItems = subscription.items?.data || [];
    const subscribedPriceId = lineItems[0]?.price?.id;
    const subscriptionTier = (EXTRA_PRICE_ID && subscribedPriceId === EXTRA_PRICE_ID) ? 'extra' : 'premium';

    console.log(`[Webhook] Determined tier: ${subscriptionTier} (priceId: ${subscribedPriceId}, extraPriceId: ${EXTRA_PRICE_ID})`);

    const updateData = {
        subscription_status: subscription.status,
        is_premium: subscription.status === 'active' || subscription.status === 'trialing',
        subscription_tier: subscriptionTier,
        subscription_end_date: endDate,
        auto_renew: !subscription.cancel_at_period_end,
    };

    console.log(`[Webhook] Updating DB for user ${profile.id} with:`, JSON.stringify(updateData));

    const { error } = await supabase.from('profiles').update(updateData).eq('id', profile.id);

    if (error) console.error(`[Webhook] Update Failed: ${error.message}`);
    else console.log(`[Webhook] Update Success.`);
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription, supabase: any) {
    console.log(`[Webhook] Subscription Deleted: ${subscription.id}`);
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
        auto_renew: false, // Ensure false on delete
    }).eq('id', profile.id);
}
