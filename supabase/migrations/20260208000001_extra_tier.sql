-- Migration: Add 'extra' subscription tier
-- This migration adds support for the Extra plan (¥3,000/month)

-- Step 1: Drop ALL existing CHECK constraints on subscription_tier (if any)
-- Note: Constraint may be named 'proper_tier', '%subscription_tier%', or other names
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    WHERE rel.relname = 'profiles'
      AND con.contype = 'c'
      AND pg_get_constraintdef(con.oid) LIKE '%subscription_tier%'
  LOOP
    EXECUTE 'ALTER TABLE profiles DROP CONSTRAINT ' || quote_ident(r.conname);
    RAISE NOTICE 'Dropped constraint: %', r.conname;
  END LOOP;
END $$;

-- Step 2: Add new CHECK constraint that includes 'extra'
ALTER TABLE profiles ADD CONSTRAINT profiles_subscription_tier_check
  CHECK (subscription_tier IN ('free', 'premium', 'extra'));

-- Step 3: Migrate any legacy 'pro' values to 'premium'
UPDATE profiles SET subscription_tier = 'premium' WHERE subscription_tier = 'pro';

-- Step 4: Add subscription_tier column if it doesn't exist (safety)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'subscription_tier'
  ) THEN
    ALTER TABLE profiles ADD COLUMN subscription_tier TEXT DEFAULT 'free';
  END IF;
END $$;
