-- Free users: change from weekly to monthly reset (2 analyses/month)
-- Premium/Extra users: keep weekly reset

CREATE OR REPLACE FUNCTION public.refresh_analysis_status(p_user_id UUID)
RETURNS TABLE (
  is_premium BOOLEAN,
  analysis_credits INTEGER,
  subscription_tier TEXT,
  daily_analysis_count INTEGER,
  last_analysis_date TIMESTAMPTZ,
  subscription_end_date TIMESTAMPTZ,
  auto_renew BOOLEAN,
  last_credit_update TIMESTAMPTZ,
  last_reward_ad_date TIMESTAMPTZ,
  weekly_analysis_count INTEGER,
  weekly_reset_date TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec RECORD;
  now_ts TIMESTAMPTZ := now();
  one_week_ms BIGINT := 7 * 24 * 60 * 60 * 1000;
  time_diff_ms BIGINT;
  weeks_passed INTEGER;
  new_credits INTEGER;
  new_last_update TIMESTAMPTZ;
  next_reset TIMESTAMPTZ;
BEGIN
  -- Authorization check
  IF p_user_id != auth.uid() THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  -- Fetch current state
  SELECT p.is_premium, p.analysis_credits, p.subscription_tier,
         p.daily_analysis_count, p.last_analysis_date,
         p.subscription_end_date, p.auto_renew,
         p.last_credit_update, p.last_reward_ad_date,
         p.weekly_analysis_count, p.weekly_reset_date
  INTO rec
  FROM profiles p
  WHERE p.id = p_user_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- 1. Self-Healing: Legacy premium users missing subscription_end_date
  IF rec.is_premium AND rec.subscription_end_date IS NULL THEN
    rec.subscription_end_date := now_ts + INTERVAL '1 month';
    rec.auto_renew := TRUE;

    UPDATE profiles SET
      subscription_end_date = rec.subscription_end_date,
      auto_renew = TRUE
    WHERE id = p_user_id;
  END IF;

  -- 2. Weekly credit replenishment (free users only)
  IF NOT rec.is_premium THEN
    IF rec.last_credit_update IS NULL THEN
      rec.last_credit_update := now_ts;
      UPDATE profiles SET last_credit_update = now_ts WHERE id = p_user_id;
    ELSE
      time_diff_ms := EXTRACT(EPOCH FROM (now_ts - rec.last_credit_update)) * 1000;
      IF time_diff_ms >= one_week_ms THEN
        weeks_passed := (time_diff_ms / one_week_ms)::INTEGER;
        IF COALESCE(rec.analysis_credits, 0) < 3 THEN
          new_credits := LEAST(COALESCE(rec.analysis_credits, 0) + weeks_passed, 3);
          new_last_update := rec.last_credit_update + (weeks_passed * INTERVAL '1 week');
          rec.analysis_credits := new_credits;
          rec.last_credit_update := new_last_update;
          UPDATE profiles SET
            analysis_credits = new_credits,
            last_credit_update = new_last_update
          WHERE id = p_user_id;
        ELSE
          rec.last_credit_update := now_ts;
          UPDATE profiles SET last_credit_update = now_ts WHERE id = p_user_id;
        END IF;
      END IF;
    END IF;
  END IF;

  -- 3. Analysis limit reset (weekly for premium/extra, monthly for free)
  IF rec.weekly_reset_date IS NULL OR now_ts >= rec.weekly_reset_date THEN
    IF rec.is_premium THEN
      -- Premium/Extra: reset weekly (next Monday)
      next_reset := date_trunc('week', now_ts + INTERVAL '7 days');
    ELSE
      -- Free: reset monthly (1st of next month)
      next_reset := date_trunc('month', now_ts) + INTERVAL '1 month';
    END IF;
    rec.weekly_analysis_count := 0;
    rec.weekly_reset_date := next_reset;
    UPDATE profiles SET
      weekly_analysis_count = 0,
      weekly_reset_date = next_reset
    WHERE id = p_user_id;
  END IF;

  IF rec.weekly_analysis_count IS NULL THEN
    rec.weekly_analysis_count := 0;
  END IF;

  -- 4. Lazy expiry check
  IF rec.is_premium AND rec.subscription_end_date IS NOT NULL THEN
    IF rec.subscription_end_date < now_ts THEN
      rec.is_premium := FALSE;
      rec.auto_renew := FALSE;
      UPDATE profiles SET is_premium = FALSE, auto_renew = FALSE WHERE id = p_user_id;
    END IF;
  END IF;

  -- Return the updated state
  RETURN QUERY SELECT
    rec.is_premium,
    rec.analysis_credits,
    rec.subscription_tier,
    rec.daily_analysis_count,
    rec.last_analysis_date,
    rec.subscription_end_date,
    rec.auto_renew,
    rec.last_credit_update,
    rec.last_reward_ad_date,
    rec.weekly_analysis_count,
    rec.weekly_reset_date;
END;
$$;
