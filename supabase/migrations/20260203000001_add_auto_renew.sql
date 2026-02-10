-- Add auto_renew column to profiles table for subscription management
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS auto_renew boolean DEFAULT true;
