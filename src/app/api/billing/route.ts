import { NextRequest, NextResponse } from 'next/server';
import { createClient, getUser } from '@/utils/supabase/server';
import { stripe } from '@/lib/stripe';
import { logger } from '@/lib/logger';
import { verifyOrigin } from '@/lib/validation';

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const originError = verifyOrigin(req);
  if (originError) return originError;

  try {
    const supabase = await createClient();
    const user = await getUser();

    if (!user) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('stripe_customer_id')
      .eq('id', user.id)
      .single();

    if (!profile?.stripe_customer_id) {
      return new NextResponse('No associated Stripe customer found. Please upgrade first.', { status: 400 });
    }

    // Determine Base URL securely (same pattern as checkout/route.ts)
    const rawUrl = process.env.NEXT_PUBLIC_APP_URL?.trim() || 'http://localhost:3000';
    const parsedUrl = new URL(rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`);
    const baseUrl = `${parsedUrl.protocol}//${parsedUrl.host}`;

    // Debug: Check Environment and Customer ID (Already logged above)
    // console.log(`[Billing Portal] Attempting to create session`);

    const session = await stripe.billingPortal.sessions.create({
      customer: profile.stripe_customer_id,
      return_url: `${baseUrl}/dashboard`,
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    logger.error("[Billing] Portal session creation failed");
    return new NextResponse(JSON.stringify({ error: "Billing service error. Please try again later." }), { status: 500 });
  }
}
