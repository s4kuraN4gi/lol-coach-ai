import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { stripe } from '@/lib/stripe';
import { logger } from '@/lib/logger';
import { z } from 'zod';
import { verifyOrigin } from '@/lib/validation';

export const dynamic = 'force-dynamic';

const ALLOWED_MONTHS = [1, 2, 3] as const;
const pauseRequestSchema = z.object({
  months: z.number().int().refine((v): v is 1 | 2 | 3 => (ALLOWED_MONTHS as readonly number[]).includes(v), {
    message: 'months must be 1, 2, or 3',
  }),
});

export async function POST(req: NextRequest) {
  const originError = verifyOrigin(req);
  if (originError) return originError;

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const parsed = pauseRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid pause duration' }, { status: 400 });
    }
    const { months } = parsed.data;

    const { data: profile } = await supabase
      .from('profiles')
      .select('stripe_subscription_id')
      .eq('id', user.id)
      .single();

    if (!profile?.stripe_subscription_id) {
      return NextResponse.json({ error: 'No active subscription found' }, { status: 400 });
    }

    // Calculate resume date (N months from now)
    const resumeDate = new Date();
    resumeDate.setMonth(resumeDate.getMonth() + months);
    const resumesAt = Math.floor(resumeDate.getTime() / 1000);

    await stripe.subscriptions.update(profile.stripe_subscription_id, {
      pause_collection: {
        behavior: 'void',
        resumes_at: resumesAt,
      },
    });

    return NextResponse.json({
      success: true,
      resumes_at: resumeDate.toISOString(),
    });
  } catch (error) {
    logger.error('[Pause] Error pausing subscription');
    return NextResponse.json(
      { error: 'Failed to pause subscription' },
      { status: 500 }
    );
  }
}
