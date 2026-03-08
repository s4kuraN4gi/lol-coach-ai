-- RPC: Sync subscription tier for users already on the correct plan.
-- Replaces adminDb usage in checkout/route.ts.

CREATE OR REPLACE FUNCTION public.sync_subscription_tier(p_user_id UUID, p_tier TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Authorization: only the authenticated user can sync their own tier
  IF p_user_id != auth.uid() THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  -- Validate tier
  IF p_tier NOT IN ('free', 'premium', 'extra') THEN
    RAISE EXCEPTION 'invalid tier';
  END IF;

  UPDATE profiles
  SET
    subscription_tier = p_tier,
    is_premium = (p_tier != 'free')
  WHERE id = p_user_id;
END;
$$;
