-- Referral program: add referral_code to profiles and create referrals tracking table

-- Add unique referral code to each user
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE;

-- Generate referral codes for existing users (8-char alphanumeric)
UPDATE profiles
SET referral_code = UPPER(SUBSTRING(MD5(id::text || NOW()::text) FROM 1 FOR 8))
WHERE referral_code IS NULL;

-- Trigger to auto-generate referral code on new user creation
CREATE OR REPLACE FUNCTION generate_referral_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.referral_code IS NULL THEN
    NEW.referral_code := UPPER(SUBSTRING(MD5(NEW.id::text || NOW()::text) FROM 1 FOR 8));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_generate_referral_code
BEFORE INSERT ON profiles
FOR EACH ROW
EXECUTE FUNCTION generate_referral_code();

-- Referrals tracking table
CREATE TABLE IF NOT EXISTS referrals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  referrer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  referred_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'rewarded')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  rewarded_at TIMESTAMPTZ,
  UNIQUE(referred_id) -- each user can only be referred once
);

-- Index for fast referral lookups
CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals(referrer_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referred ON referrals(referred_id);

-- RLS for referrals table
ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;

-- Users can see their own referrals (as referrer)
CREATE POLICY referrals_select_own ON referrals
  FOR SELECT TO authenticated
  USING (referrer_id = auth.uid());

-- Insert allowed via RPC only (no direct insert policy)

-- RPC to process a referral signup
CREATE OR REPLACE FUNCTION process_referral(
  p_referral_code TEXT,
  p_referred_user_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_referrer_id UUID;
  v_existing RECORD;
BEGIN
  -- Find the referrer
  SELECT id INTO v_referrer_id
  FROM profiles
  WHERE referral_code = p_referral_code;

  IF v_referrer_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_code');
  END IF;

  -- Can't refer yourself
  IF v_referrer_id = p_referred_user_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'self_referral');
  END IF;

  -- Check if already referred
  SELECT * INTO v_existing
  FROM referrals
  WHERE referred_id = p_referred_user_id;

  IF v_existing IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'already_referred');
  END IF;

  -- Create referral record
  INSERT INTO referrals (referrer_id, referred_id, status)
  VALUES (v_referrer_id, p_referred_user_id, 'pending');

  RETURN jsonb_build_object('success', true, 'referrer_id', v_referrer_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC to reward referrer (called when referred user becomes premium)
CREATE OR REPLACE FUNCTION reward_referral(
  p_referred_user_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_referral RECORD;
BEGIN
  -- Find pending referral
  SELECT * INTO v_referral
  FROM referrals
  WHERE referred_id = p_referred_user_id
    AND status = 'pending';

  IF v_referral IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'no_pending_referral');
  END IF;

  -- Extend referrer's subscription by 7 days
  UPDATE profiles
  SET subscription_end_date = GREATEST(
    COALESCE(subscription_end_date, NOW()),
    NOW()
  ) + INTERVAL '7 days'
  WHERE id = v_referral.referrer_id
    AND is_premium = true;

  -- Mark referral as rewarded
  UPDATE referrals
  SET status = 'rewarded', rewarded_at = NOW()
  WHERE id = v_referral.id;

  RETURN jsonb_build_object('success', true, 'referrer_id', v_referral.referrer_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Allow profiles to read their own referral_code
COMMENT ON COLUMN profiles.referral_code IS 'Unique referral code for invite program';
