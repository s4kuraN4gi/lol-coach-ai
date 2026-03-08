-- RPC: Atomically update daily analysis count with daily reset logic.
-- Replaces adminDb.from("profiles").update({daily_analysis_count, last_analysis_date})
-- to avoid using service role client for this operation.

CREATE OR REPLACE FUNCTION public.update_daily_analysis_count(p_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  today DATE := CURRENT_DATE;
BEGIN
  -- Authorization: only the authenticated user can update their own count
  IF p_user_id != auth.uid() THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  UPDATE profiles
  SET
    daily_analysis_count = CASE
      WHEN last_analysis_date::date = today THEN daily_analysis_count + 1
      ELSE 1
    END,
    last_analysis_date = now()
  WHERE id = p_user_id;
END;
$$;
