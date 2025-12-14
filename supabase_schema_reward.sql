-- Add last_reward_ad_date column to profiles table to track daily reward claims
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS last_reward_ad_date TIMESTAMP WITH TIME ZONE;
