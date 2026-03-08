-- Atomic credit decrement for free users
-- Returns the new credit count, or -1 if insufficient credits
CREATE OR REPLACE FUNCTION decrement_analysis_credits(p_user_id UUID)
RETURNS INT AS $$
DECLARE
  new_credits INT;
BEGIN
  UPDATE profiles
  SET analysis_credits = GREATEST(analysis_credits - 1, 0)
  WHERE id = p_user_id AND analysis_credits > 0
  RETURNING analysis_credits INTO new_credits;

  IF NOT FOUND THEN
    RETURN -1;
  END IF;

  RETURN new_credits;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Atomic weekly analysis count increment for premium users
-- Returns the new count, or -1 if limit exceeded
CREATE OR REPLACE FUNCTION increment_weekly_count(p_user_id UUID, p_limit INT)
RETURNS INT AS $$
DECLARE
  new_count INT;
BEGIN
  UPDATE profiles
  SET weekly_analysis_count = weekly_analysis_count + 1
  WHERE id = p_user_id AND weekly_analysis_count < p_limit
  RETURNING weekly_analysis_count INTO new_count;

  IF NOT FOUND THEN
    RETURN -1;
  END IF;

  RETURN new_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Atomic weekly analysis count decrement (for refund on failure)
-- Returns the new count
CREATE OR REPLACE FUNCTION decrement_weekly_count(p_user_id UUID)
RETURNS INT AS $$
DECLARE
  new_count INT;
BEGIN
  UPDATE profiles
  SET weekly_analysis_count = GREATEST(weekly_analysis_count - 1, 0)
  WHERE id = p_user_id AND weekly_analysis_count > 0
  RETURNING weekly_analysis_count INTO new_count;

  IF NOT FOUND THEN
    RETURN 0;
  END IF;

  RETURN new_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Atomic credit increment (for refund on failure)
CREATE OR REPLACE FUNCTION increment_analysis_credits(p_user_id UUID)
RETURNS INT AS $$
DECLARE
  new_credits INT;
BEGIN
  UPDATE profiles
  SET analysis_credits = analysis_credits + 1
  WHERE id = p_user_id
  RETURNING analysis_credits INTO new_credits;

  IF NOT FOUND THEN
    RETURN -1;
  END IF;

  RETURN new_credits;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
