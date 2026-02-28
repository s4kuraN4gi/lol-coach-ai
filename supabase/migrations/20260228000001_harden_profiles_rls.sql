-- =============================================================
-- Migration: Harden profiles RLS + SECURITY DEFINER functions
-- Date: 2026-02-28
-- Issues: CRITICAL-1 (SELECT全公開), CRITICAL-2 (UPDATE無制限), MEDIUM-4 (RPC auth check)
-- =============================================================

-- -------------------------------------------------------
-- 1. Fix SELECT policy: own profile only (was: everyone)
-- -------------------------------------------------------
DROP POLICY IF EXISTS "Public profiles are viewable by everyone." ON public.profiles;
CREATE POLICY "Users can view their own profile."
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

-- -------------------------------------------------------
-- 2. Fix UPDATE policy: restrict to safe columns only
--    Sensitive columns (is_premium, credits, stripe_*, etc.)
--    can only be updated via Service Role (bypasses RLS).
--
--    PostgreSQL RLS cannot do column-level checks directly,
--    so we use a WITH CHECK that verifies sensitive columns
--    haven't been changed by comparing to existing values.
-- -------------------------------------------------------
DROP POLICY IF EXISTS "Users can update their own profile." ON public.profiles;

CREATE POLICY "Users can update their own safe columns."
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    -- Ensure sensitive columns are not changed by the user
    AND is_premium IS NOT DISTINCT FROM (SELECT p.is_premium FROM public.profiles p WHERE p.id = auth.uid())
    AND analysis_credits IS NOT DISTINCT FROM (SELECT p.analysis_credits FROM public.profiles p WHERE p.id = auth.uid())
    AND subscription_tier IS NOT DISTINCT FROM (SELECT p.subscription_tier FROM public.profiles p WHERE p.id = auth.uid())
    AND stripe_customer_id IS NOT DISTINCT FROM (SELECT p.stripe_customer_id FROM public.profiles p WHERE p.id = auth.uid())
    AND stripe_subscription_id IS NOT DISTINCT FROM (SELECT p.stripe_subscription_id FROM public.profiles p WHERE p.id = auth.uid())
    AND subscription_status IS NOT DISTINCT FROM (SELECT p.subscription_status FROM public.profiles p WHERE p.id = auth.uid())
    AND subscription_end_date IS NOT DISTINCT FROM (SELECT p.subscription_end_date FROM public.profiles p WHERE p.id = auth.uid())
    AND auto_renew IS NOT DISTINCT FROM (SELECT p.auto_renew FROM public.profiles p WHERE p.id = auth.uid())
    AND weekly_analysis_count IS NOT DISTINCT FROM (SELECT p.weekly_analysis_count FROM public.profiles p WHERE p.id = auth.uid())
    AND weekly_reset_date IS NOT DISTINCT FROM (SELECT p.weekly_reset_date FROM public.profiles p WHERE p.id = auth.uid())
    AND daily_analysis_count IS NOT DISTINCT FROM (SELECT p.daily_analysis_count FROM public.profiles p WHERE p.id = auth.uid())
    AND last_analysis_date IS NOT DISTINCT FROM (SELECT p.last_analysis_date FROM public.profiles p WHERE p.id = auth.uid())
    AND last_credit_update IS NOT DISTINCT FROM (SELECT p.last_credit_update FROM public.profiles p WHERE p.id = auth.uid())
    AND last_reward_ad_date IS NOT DISTINCT FROM (SELECT p.last_reward_ad_date FROM public.profiles p WHERE p.id = auth.uid())
    AND daily_chat_count IS NOT DISTINCT FROM (SELECT p.daily_chat_count FROM public.profiles p WHERE p.id = auth.uid())
    AND last_chat_reset IS NOT DISTINCT FROM (SELECT p.last_chat_reset FROM public.profiles p WHERE p.id = auth.uid())
  );

-- -------------------------------------------------------
-- 3. Add auth.uid() check to SECURITY DEFINER functions
--    Prevents users from calling RPCs with another user's ID
-- -------------------------------------------------------

-- Recreate decrement_analysis_credits with auth check
CREATE OR REPLACE FUNCTION public.decrement_analysis_credits(p_user_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_credits INTEGER;
BEGIN
  -- Verify caller is the owner
  IF p_user_id != auth.uid() THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  UPDATE profiles
  SET analysis_credits = analysis_credits - 1
  WHERE id = p_user_id AND analysis_credits > 0
  RETURNING analysis_credits INTO new_credits;

  IF NOT FOUND THEN
    RETURN -1;
  END IF;
  RETURN new_credits;
END;
$$;

-- Recreate increment_weekly_count with auth check
CREATE OR REPLACE FUNCTION public.increment_weekly_count(p_user_id UUID, p_limit INTEGER)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_count INTEGER;
BEGIN
  IF p_user_id != auth.uid() THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  UPDATE profiles
  SET weekly_analysis_count = weekly_analysis_count + 1
  WHERE id = p_user_id AND weekly_analysis_count < p_limit
  RETURNING weekly_analysis_count INTO new_count;

  IF NOT FOUND THEN
    RETURN -1;
  END IF;
  RETURN new_count;
END;
$$;

-- Recreate decrement_weekly_count with auth check
CREATE OR REPLACE FUNCTION public.decrement_weekly_count(p_user_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_count INTEGER;
BEGIN
  IF p_user_id != auth.uid() THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  UPDATE profiles
  SET weekly_analysis_count = GREATEST(weekly_analysis_count - 1, 0)
  WHERE id = p_user_id
  RETURNING weekly_analysis_count INTO new_count;

  IF NOT FOUND THEN
    RETURN -1;
  END IF;
  RETURN new_count;
END;
$$;

-- Recreate increment_analysis_credits with auth check
CREATE OR REPLACE FUNCTION public.increment_analysis_credits(p_user_id UUID, p_amount INTEGER DEFAULT 1)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_credits INTEGER;
BEGIN
  IF p_user_id != auth.uid() THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  UPDATE profiles
  SET analysis_credits = analysis_credits + p_amount
  WHERE id = p_user_id
  RETURNING analysis_credits INTO new_credits;

  IF NOT FOUND THEN
    RETURN -1;
  END IF;
  RETURN new_credits;
END;
$$;

-- -------------------------------------------------------
-- 4. Atomic daily reward claim (prevents double-claim race condition)
-- Returns new_credits on success, -1 if already claimed today, -2 if not found
-- -------------------------------------------------------
CREATE OR REPLACE FUNCTION public.claim_daily_reward(p_user_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_credits INTEGER;
BEGIN
  IF p_user_id != auth.uid() THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  UPDATE profiles
  SET
    analysis_credits = analysis_credits + 1,
    last_reward_ad_date = now()
  WHERE id = p_user_id
    AND (
      last_reward_ad_date IS NULL
      OR last_reward_ad_date::date < CURRENT_DATE
    )
  RETURNING analysis_credits INTO new_credits;

  IF NOT FOUND THEN
    RETURN -1; -- Already claimed today
  END IF;
  RETURN new_credits;
END;
$$;
