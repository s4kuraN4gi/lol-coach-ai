import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/utils/supabase/server';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    logger.error('[Cleanup] CRON_SECRET not configured');
    return NextResponse.json({ error: 'Cron secret not configured' }, { status: 500 });
  }

  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createServiceRoleClient();

  // Clean up stale rate limit entries (older than 1 hour)
  const { error: rlError } = await supabase.rpc('cleanup_rate_limits');
  if (rlError) {
    logger.error('[Cleanup] Failed to cleanup rate limits:', rlError.message);
  }

  // Clean up old webhook idempotency records (older than 7 days)
  const { error: whError } = await supabase
    .from('webhook_events')
    .delete()
    .lt('processed_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());
  if (whError) {
    logger.error('[Cleanup] Failed to cleanup webhook events:', whError.message);
  }

  // Clean up match cache older than 90 days (privacy policy compliance)
  const { error: mcError } = await supabase
    .from('match_cache')
    .delete()
    .lt('created_at', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString());
  if (mcError) {
    logger.error('[Cleanup] Failed to cleanup match cache:', mcError.message);
  }

  return NextResponse.json({
    rate_limits: rlError ? 'error' : 'cleaned',
    webhook_events: whError ? 'error' : 'cleaned',
    match_cache: mcError ? 'error' : 'cleaned',
  });
}
