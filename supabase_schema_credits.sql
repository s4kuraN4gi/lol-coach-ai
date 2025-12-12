-- Add last_credit_update column to profiles for weekly replenishment tracking
-- Run this in your Supabase SQL Editor

ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS last_credit_update timestamp with time zone DEFAULT now();

-- Ensure analysis_credits exists (just in case)
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS analysis_credits integer DEFAULT 3;

-- Initial seed for existing users (set update time to now so they start fresh)
UPDATE public.profiles 
SET last_credit_update = now() 
WHERE last_credit_update IS NULL;
