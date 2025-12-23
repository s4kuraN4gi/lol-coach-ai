import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { stripe } from '@/lib/stripe';

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const { priceId } = await req.json();

    if (!priceId) {
      return new NextResponse('Price ID is required', { status: 400 });
    }

    // Check if user already has a customer ID
    const { data: profile } = await supabase
      .from('profiles')
      .select('stripe_customer_id')
      .eq('id', user.id)
      .single();

    let customerId = profile?.stripe_customer_id;

    // Create a Checkout Session
    console.log("Creating checkout session for", user.id, "with price", priceId);
    console.log("Secret Key Present:", !!process.env.STRIPE_SECRET_KEY);
    
    if(!process.env.STRIPE_SECRET_KEY) {
         throw new Error("STRIPE_SECRET_KEY is missing");
    }

    // Trim and validate Price ID
    const sanitizedPriceId = priceId?.trim();
    
    // Determine Base URL securely
    let baseUrl = process.env.NEXT_PUBLIC_APP_URL?.trim() || 'http://localhost:3000';
    
    // Force HTTP for localhost to avoid SSL errors during dev
    if (baseUrl.includes('localhost') && !baseUrl.startsWith('http')) {
        baseUrl = `http://${baseUrl}`;
    } else if (!baseUrl.startsWith('http')) {
        baseUrl = `https://${baseUrl}`;
    }

    // Remove trailing slash if present to avoid double slashes
    baseUrl = baseUrl.replace(/\/$/, '');

    const successUrl = `${baseUrl}/dashboard?checkout=success`;
    const cancelUrl = `${baseUrl}/dashboard?checkout=cancel`;

    console.log("Debug Config:", {
        priceId: sanitizedPriceId,
        baseUrl: baseUrl,
        successUrl: successUrl,
        cancelUrl: cancelUrl
    });

    if (!sanitizedPriceId) {
        throw new Error("Price ID is missing or empty");
    }

    const session = await stripe.checkout.sessions.create({
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
      },
    });

    console.log("Session created:", session.id);
    return NextResponse.json({ url: session.url });
  } catch (error: any) {
    console.error('Stripe Checkout Error:', error);
    return new NextResponse(JSON.stringify({ error: error.message }), { status: 500 });
  }
}
