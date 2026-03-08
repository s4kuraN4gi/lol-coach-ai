import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient, getUser } from '@/utils/supabase/server';
import { stripe } from '@/lib/stripe';
import { checkoutRequestSchema, verifyOrigin } from '@/lib/validation';
import { logger } from '@/lib/logger';

export async function POST(req: NextRequest) {
  const originError = verifyOrigin(req);
  if (originError) return originError;

  try {
    const supabase = await createClient();
    const user = await getUser();

    if (!user) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const body = await req.json();
    const parsed = checkoutRequestSchema.safeParse(body);
    if (!parsed.success) {
      return new NextResponse('Invalid request', { status: 400 });
    }
    const { priceId } = parsed.data;

    // Whitelist check: only allow known price IDs (monthly + annual)
    const allowedPriceIds = [
      process.env.NEXT_PUBLIC_STRIPE_PRICE_ID,
      process.env.NEXT_PUBLIC_STRIPE_EXTRA_PRICE_ID,
      process.env.NEXT_PUBLIC_STRIPE_PREMIUM_ANNUAL_PRICE_ID,
      process.env.NEXT_PUBLIC_STRIPE_EXTRA_ANNUAL_PRICE_ID,
    ].filter(Boolean);
    if (!allowedPriceIds.includes(priceId)) {
      return new NextResponse('Invalid Price ID', { status: 400 });
    }

    // Check if user already has a customer ID and subscription
    const { data: profile } = await supabase
      .from('profiles')
      .select('stripe_customer_id, stripe_subscription_id, language_preference')
      .eq('id', user.id)
      .single();

    let customerId = profile?.stripe_customer_id;

    if(!process.env.STRIPE_SECRET_KEY) {
         throw new Error("STRIPE_SECRET_KEY is missing");
    }

    // Trim and validate Price ID
    const sanitizedPriceId = priceId?.trim();

    if (!sanitizedPriceId) {
        throw new Error("Price ID is missing or empty");
    }

    // Determine Base URL securely using URL constructor for safe parsing
    let rawUrl = process.env.NEXT_PUBLIC_APP_URL?.trim() || 'http://localhost:3000';
    if (!rawUrl.startsWith('http')) {
        rawUrl = rawUrl.includes('localhost') ? `http://${rawUrl}` : `https://${rawUrl}`;
    }
    const parsedUrl = new URL(rawUrl);
    const baseUrl = `${parsedUrl.protocol}//${parsedUrl.host}`;

    const successUrl = `${baseUrl}/dashboard?checkout=success`;
    const cancelUrl = `${baseUrl}/dashboard?checkout=cancel`;

    // If no customer ID in DB, search Stripe by email
    if (!customerId && user.email) {
      const customers = await stripe.customers.list({ email: user.email, limit: 1 });
      if (customers.data.length > 0) {
        customerId = customers.data[0].id;
      }
    }

    // Find existing subscription: first from DB, then from Stripe customer
    let existingSubscriptionId = profile?.stripe_subscription_id;

    if (!existingSubscriptionId && customerId) {
      const subs = await stripe.subscriptions.list({
        customer: customerId,
        status: 'active',
        limit: 5,
      });
      if (subs.data.length > 0) {
        existingSubscriptionId = subs.data[0].id;
      }
    }

    // Check for existing active subscription (plan switch with proration)
    let discounts: { coupon: string }[] | undefined;
    let oldSubscriptionId: string | undefined;

    if (existingSubscriptionId) {
      try {
        const existingSub = await stripe.subscriptions.retrieve(existingSubscriptionId);

        if (existingSub.status === 'active' || existingSub.status === 'trialing') {
          const currentPriceId = existingSub.items.data[0]?.price?.id;

          // Already on the requested price — sync DB tier and redirect
          if (currentPriceId === sanitizedPriceId) {
            const extraPriceIds = [
              process.env.NEXT_PUBLIC_STRIPE_EXTRA_PRICE_ID,
              process.env.NEXT_PUBLIC_STRIPE_EXTRA_ANNUAL_PRICE_ID,
            ].filter(Boolean);
            const tier = extraPriceIds.includes(currentPriceId ?? '') ? 'extra' : 'premium';
            // Sync subscription tier via RPC (no service role needed)
            const { error: syncErr } = await supabase.rpc('sync_subscription_tier', {
              p_user_id: user.id,
              p_tier: tier,
            });
            if (syncErr) {
              logger.error("[Checkout] Tier sync failed");
            }
            return NextResponse.json({ url: `${baseUrl}/dashboard?checkout=success` });
          }

          // Calculate prorated credit for remaining days on current plan
          const currentItem = existingSub.items.data[0];
          const currentPrice = currentItem?.price;
          const periodEnd = (currentItem as any)?.current_period_end as number | undefined
            ?? (existingSub as any).current_period_end as number | undefined;
          const periodStart = (currentItem as any)?.current_period_start as number | undefined
            ?? (existingSub as any).current_period_start as number | undefined;
          const now = Math.floor(Date.now() / 1000);

          if (periodEnd && periodStart && periodEnd > now && currentPrice?.unit_amount) {
            const totalSeconds = periodEnd - periodStart;
            const remainingSeconds = periodEnd - now;
            const creditAmount = Math.round(
              (currentPrice.unit_amount * remainingSeconds) / totalSeconds
            );

            if (creditAmount > 0) {
              const remainingDays = Math.ceil(remainingSeconds / 86400);

              // Idempotency key prevents duplicate coupons on concurrent requests
              const idempotencyKey = `coupon_${user.id}_${existingSub.id}_${sanitizedPriceId}`;
              const coupon = await stripe.coupons.create({
                amount_off: creditAmount,
                currency: currentPrice.currency || 'jpy',
                duration: 'once',
                name: getCouponName(remainingDays, profile?.language_preference),
              }, { idempotencyKey });

              discounts = [{ coupon: coupon.id }];
            }
          }

          oldSubscriptionId = existingSub.id;
        }
      } catch (e) {
        logger.error("[Checkout] Existing subscription retrieval failed");
      }
    }

    // Create Stripe Checkout Session (always show payment page)
    const isNewSubscriber = !existingSubscriptionId && !profile?.stripe_subscription_id;

    // Check if user was referred — extend trial to 14 days as referral bonus
    let trialDays = 7;
    if (isNewSubscriber) {
      const { count } = await supabase
        .from('referrals')
        .select('id', { count: 'exact', head: true })
        .eq('referred_id', user.id);
      if (count && count > 0) {
        trialDays = 14;
      }
    }

    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      customer: customerId ? customerId : undefined,
      customer_email: (!customerId && user.email) ? user.email : undefined,
      client_reference_id: user.id,
      payment_method_types: ['card'],
      mode: 'subscription',
      line_items: [
        {
          price: sanitizedPriceId,
          quantity: 1,
        },
      ],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        userId: user.id,
        ...(oldSubscriptionId ? { oldSubscriptionId } : {}),
      },
      // Free trial for first-time subscribers (14 days if referred, 7 days otherwise)
      ...(isNewSubscriber && !discounts ? {
        subscription_data: {
          trial_period_days: trialDays,
        },
      } : {}),
    };

    if (discounts) {
      sessionParams.discounts = discounts;
    }

    // 5-minute bucket prevents duplicate sessions from rapid clicks
    const timeBucket = Math.floor(Date.now() / (5 * 60 * 1000));
    const sessionIdempotencyKey = `checkout_${user.id}_${sanitizedPriceId}_${timeBucket}`;
    const session = await stripe.checkout.sessions.create(sessionParams, { idempotencyKey: sessionIdempotencyKey });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    logger.error("[Checkout] Session creation failed");
    return new NextResponse(JSON.stringify({ error: "Checkout service error. Please try again later." }), { status: 500 });
  }
}

function getCouponName(remainingDays: number, lang?: string | null): string {
  switch (lang) {
    case 'en':
      return `Plan switch credit (${remainingDays} days remaining)`;
    case 'ko':
      return `플랜 전환 크레딧 (${remainingDays}일 남음)`;
    default:
      return `プラン切替クレジット (残${remainingDays}日分)`;
  }
}
