-- RPC: downgrade_to_free — set auto_renew = false for the authenticated user.
-- Replaces adminDb usage in downgradeToFree().

CREATE OR REPLACE FUNCTION public.downgrade_to_free(p_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_user_id != auth.uid() THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  UPDATE profiles
  SET auto_renew = FALSE
  WHERE id = p_user_id;
END;
$$;

-- RPC: sync_subscription_status — atomically update all subscription fields.
-- Replaces adminDb usage in syncSubscriptionStatus().

CREATE OR REPLACE FUNCTION public.sync_subscription_status(
  p_user_id UUID,
  p_stripe_subscription_id TEXT,
  p_subscription_status TEXT,
  p_is_premium BOOLEAN,
  p_subscription_tier TEXT,
  p_subscription_end_date TIMESTAMPTZ,
  p_auto_renew BOOLEAN,
  p_stripe_customer_id TEXT DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_user_id != auth.uid() THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  -- Validate tier
  IF p_subscription_tier NOT IN ('free', 'premium', 'extra') THEN
    RAISE EXCEPTION 'invalid tier';
  END IF;

  UPDATE profiles
  SET
    stripe_subscription_id = p_stripe_subscription_id,
    subscription_status = p_subscription_status,
    is_premium = p_is_premium,
    subscription_tier = p_subscription_tier,
    subscription_end_date = p_subscription_end_date,
    auto_renew = p_auto_renew,
    stripe_customer_id = COALESCE(p_stripe_customer_id, stripe_customer_id)
  WHERE id = p_user_id;
END;
$$;
