-- Migration: Add rank_info and last_updated_at to summoner_accounts

ALTER TABLE public.summoner_accounts
ADD COLUMN IF NOT EXISTS rank_info JSONB,
ADD COLUMN IF NOT EXISTS recent_match_ids JSONB,
ADD COLUMN IF NOT EXISTS last_updated_at TIMESTAMP WITH TIME ZONE;
