import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { stripe } from '@/lib/stripe';

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const keyPrefix = process.env.STRIPE_SECRET_KEY?.substring(0, 7) || 'UNKNOWN';
    console.log(`[Billing Portal] Request received. KeyPrefix: ${keyPrefix}`);
    
    // TEMPORARY DEBUG: Return key status immediately
    return NextResponse.json({ 
      error: `DEBUG MODE: Key=${keyPrefix}, Node=${process.env.NODE_ENV}, Vercel=${process.env.VERCEL || 'No'}` 
    }, { status: 500 });

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('stripe_customer_id')
      .eq('id', user!.id)
      .single();

    if (!profile?.stripe_customer_id) {
      return new NextResponse('No associated Stripe customer found. Please upgrade first.', { status: 400 });
    }

    // Determine Base URL securely
    let baseUrl = process.env.NEXT_PUBLIC_APP_URL?.trim() || 'http://localhost:3000';
    
    // Force HTTP for localhost to avoid SSL errors during dev
    if (baseUrl.includes('localhost') && !baseUrl.startsWith('http')) {
        baseUrl = `http://${baseUrl}`;
    } else if (!baseUrl.startsWith('http')) {
        baseUrl = `https://${baseUrl}`;
    }
    // Remove trailing slash
    baseUrl = baseUrl.replace(/\/$/, '');

    // Debug: Check Environment and Customer ID (Already logged above)
    // console.log(`[Billing Portal] Attempting to create session`);

    const session = await stripe.billingPortal.sessions.create({
      customer: profile!.stripe_customer_id,
      return_url: `${baseUrl}/dashboard`,
    });

    return NextResponse.json({ url: session.url });
  } catch (error: any) {
    console.error('Stripe Portal Error:', error);
    return new NextResponse(JSON.stringify({ error: error.message }), { status: 500 });
  }
}
