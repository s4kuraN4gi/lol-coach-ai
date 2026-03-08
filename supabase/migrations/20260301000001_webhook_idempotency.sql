-- Webhook idempotency: DB-based instead of in-memory Set
-- In-memory Set is unsafe on serverless (Vercel) where each request may run on a different instance.
-- This table ensures Stripe webhook events are processed exactly once.

CREATE TABLE IF NOT EXISTS public.processed_webhook_events (
  event_id TEXT PRIMARY KEY,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS enabled but no policies = only service role can access
ALTER TABLE public.processed_webhook_events ENABLE ROW LEVEL SECURITY;

-- Atomic claim function: returns true if this is the first time we see this event
CREATE OR REPLACE FUNCTION public.claim_webhook_event(p_event_id TEXT)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO processed_webhook_events (event_id) VALUES (p_event_id);
  RETURN true;
EXCEPTION WHEN unique_violation THEN
  RETURN false;
END;
$$;

-- Cleanup: delete events older than 7 days (run periodically via cron or manually)
CREATE OR REPLACE FUNCTION public.cleanup_old_webhook_events()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count integer;
BEGIN
  DELETE FROM processed_webhook_events
  WHERE processed_at < now() - INTERVAL '7 days';
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;
