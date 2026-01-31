-- Add rank_goal column to summoner_accounts table
-- Stores user's target rank goal as JSON: { tier: "GOLD", rank: "IV" }

ALTER TABLE public.summoner_accounts
ADD COLUMN IF NOT EXISTS rank_goal JSONB DEFAULT NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.summoner_accounts.rank_goal IS 'User rank goal: { tier: string, rank: string, set_at: timestamp }';
