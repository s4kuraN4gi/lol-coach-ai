-- Atomic daily chat count increment with auto-reset
-- Returns the new count, or -1 if daily limit exceeded
CREATE OR REPLACE FUNCTION public.increment_daily_chat_count(p_user_id UUID, p_limit INTEGER)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_count INTEGER;
  today DATE := CURRENT_DATE;
BEGIN
  IF p_user_id != auth.uid() THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  -- Reset count if last_chat_reset is not today, then increment
  UPDATE profiles
  SET
    daily_chat_count = CASE
      WHEN last_chat_reset::date = today THEN daily_chat_count + 1
      ELSE 1
    END,
    last_chat_reset = now()
  WHERE id = p_user_id
    AND CASE
      WHEN last_chat_reset::date = today THEN daily_chat_count < p_limit
      ELSE true  -- new day, always allow
    END
  RETURNING daily_chat_count INTO new_count;

  IF NOT FOUND THEN
    RETURN -1;
  END IF;
  RETURN new_count;
END;
$$;
