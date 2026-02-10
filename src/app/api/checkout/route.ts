import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceRoleClient } from '@/utils/supabase/server';
import { stripe } from '@/lib/stripe';

export async function POST(req: NextRequest) {
  console.log('[Checkout] === POST /api/checkout called ===');
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      console.log('[Checkout] ERROR: Unauthorized (no user session)');
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const body = await req.json();
    const priceId = body?.priceId;
    console.log(`[Checkout] Received body: ${JSON.stringify(body)}`);

    if (!priceId) {
      console.log('[Checkout] ERROR: Price ID is missing from request body');
      return new NextResponse('Price ID is required', { status: 400 });
    }

    // Check if user already has a customer ID and subscription
    const { data: profile } = await supabase
      .from('profiles')
      .select('stripe_customer_id, stripe_subscription_id')
      .eq('id', user.id)
      .single();

    let customerId = profile?.stripe_customer_id;

    console.log(`[Checkout] Request for user=${user.id}, email=${user.email}, price=${priceId}`);
    console.log(`[Checkout] Profile from DB: customerId=${customerId}, subId=${profile?.stripe_subscription_id}`);

    if(!process.env.STRIPE_SECRET_KEY) {
         throw new Error("STRIPE_SECRET_KEY is missing");
    }

    // Trim and validate Price ID
    const sanitizedPriceId = priceId?.trim();

    if (!sanitizedPriceId) {
        throw new Error("Price ID is missing or empty");
    }

    // Determine Base URL securely
    let baseUrl = process.env.NEXT_PUBLIC_APP_URL?.trim() || 'http://localhost:3000';

    if (baseUrl.includes('localhost') && !baseUrl.startsWith('http')) {
        baseUrl = `http://${baseUrl}`;
    } else if (!baseUrl.startsWith('http')) {
        baseUrl = `https://${baseUrl}`;
    }

    baseUrl = baseUrl.replace(/\/$/, '');

    const successUrl = `${baseUrl}/dashboard?checkout=success`;
    const cancelUrl = `${baseUrl}/dashboard?checkout=cancel`;

    // If no customer ID in DB, search Stripe by email
    if (!customerId && user.email) {
      console.log(`[Checkout] No customer ID in DB, searching Stripe by email: ${user.email}`);
      const customers = await stripe.customers.list({ email: user.email, limit: 1 });
      if (customers.data.length > 0) {
        customerId = customers.data[0].id;
        console.log(`[Checkout] Found Stripe customer by email: ${customerId}`);
      }
    }

    // Find existing subscription: first from DB, then from Stripe customer
    let existingSubscriptionId = profile?.stripe_subscription_id;

    if (!existingSubscriptionId && customerId) {
      console.log(`[Checkout] No subscription ID in DB, listing active subs for customer: ${customerId}`);
      const subs = await stripe.subscriptions.list({
        customer: customerId,
        status: 'active',
        limit: 5,
      });
      if (subs.data.length > 0) {
        existingSubscriptionId = subs.data[0].id;
        console.log(`[Checkout] Found active subscription from Stripe: ${existingSubscriptionId}`);
      }
    }

    // Check for existing active subscription (plan switch with proration)
    let discounts: { coupon: string }[] | undefined;
    let oldSubscriptionId: string | undefined;

    console.log(`[Checkout] existingSubscriptionId=${existingSubscriptionId}`);

    if (existingSubscriptionId) {
      try {
        const existingSub = await stripe.subscriptions.retrieve(existingSubscriptionId);

        console.log(`[Checkout] Existing sub status=${existingSub.status}, priceId=${existingSub.items.data[0]?.price?.id}, requestedPrice=${sanitizedPriceId}`);

        if (existingSub.status === 'active' || existingSub.status === 'trialing') {
          const currentPriceId = existingSub.items.data[0]?.price?.id;

          // Already on the requested price — sync DB tier and redirect
          if (currentPriceId === sanitizedPriceId) {
            const EXTRA_PRICE_ID_CHECK = process.env.NEXT_PUBLIC_STRIPE_EXTRA_PRICE_ID;
            const tier = (EXTRA_PRICE_ID_CHECK && currentPriceId === EXTRA_PRICE_ID_CHECK) ? 'extra' : 'premium';
            console.log(`[Checkout] Already on requested plan. currentPriceId=${currentPriceId}, EXTRA_PRICE_ID=${EXTRA_PRICE_ID_CHECK}, determined tier=${tier}`);
            // Use service role client to bypass RLS for subscription_tier update
            const adminDb = createServiceRoleClient();
            const { data: updated, error: updateErr } = await adminDb.from('profiles').update({
              subscription_tier: tier,
              is_premium: true,
            }).eq('id', user.id).select('subscription_tier, is_premium');
            if (updateErr) {
              console.error(`[Checkout] DB update FAILED: ${updateErr.message} (code: ${updateErr.code}, details: ${updateErr.details})`);
            } else {
              console.log(`[Checkout] DB update result:`, JSON.stringify(updated));
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

          console.log(`[Checkout] Proration check: periodEnd=${periodEnd}, periodStart=${periodStart}, now=${now}, unit_amount=${currentPrice?.unit_amount}, currency=${currentPrice?.currency}`);

          if (periodEnd && periodStart && periodEnd > now && currentPrice?.unit_amount) {
            const totalSeconds = periodEnd - periodStart;
            const remainingSeconds = periodEnd - now;
            const creditAmount = Math.round(
              (currentPrice.unit_amount * remainingSeconds) / totalSeconds
            );

            if (creditAmount > 0) {
              const remainingDays = Math.ceil(remainingSeconds / 86400);
              console.log(`[Checkout] Proration: ${remainingDays} days remaining, credit ¥${creditAmount}`);

              const coupon = await stripe.coupons.create({
                amount_off: creditAmount,
                currency: currentPrice.currency || 'jpy',
                duration: 'once',
                name: `プラン切替クレジット (残${remainingDays}日分)`,
              });

              discounts = [{ coupon: coupon.id }];
            }
          }

          oldSubscriptionId = existingSub.id;
          console.log(`[Checkout] Will cancel old subscription ${oldSubscriptionId} after successful checkout`);
        }
      } catch (e: any) {
        console.log(`[Checkout] Could not retrieve existing subscription: ${e.message}`);
      }
    } else {
      console.log(`[Checkout] No existing subscription found, skipping proration`);
    }

    console.log(`[Checkout] Creating session: customerId=${customerId}, discounts=${JSON.stringify(discounts)}, oldSub=${oldSubscriptionId}`);

    // Create Stripe Checkout Session (always show payment page)
    const sessionParams: any = {
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
    };

    if (discounts) {
      sessionParams.discounts = discounts;
    }

    const session = await stripe.checkout.sessions.create(sessionParams);

    console.log("Session created:", session.id, oldSubscriptionId ? `(will cancel ${oldSubscriptionId})` : '');
    return NextResponse.json({ url: session.url });
  } catch (error: any) {
    console.error('Stripe Checkout Error:', error);
    return new NextResponse(JSON.stringify({ error: error.message }), { status: 500 });
  }
}
