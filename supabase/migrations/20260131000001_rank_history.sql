-- Migration: Create rank_history table for tracking LP/tier changes over time

CREATE TABLE IF NOT EXISTS public.rank_history (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    puuid TEXT NOT NULL,
    queue_type TEXT NOT NULL, -- RANKED_SOLO_5x5 or RANKED_FLEX_SR
    tier TEXT, -- IRON, BRONZE, SILVER, etc.
    rank TEXT, -- I, II, III, IV
    league_points INTEGER,
    wins INTEGER,
    losses INTEGER,
    recorded_at DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Unique constraint: one record per puuid/queue_type/date
    CONSTRAINT unique_rank_history_per_day UNIQUE (puuid, queue_type, recorded_at)
);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_rank_history_puuid ON public.rank_history(puuid);
CREATE INDEX IF NOT EXISTS idx_rank_history_recorded_at ON public.rank_history(recorded_at DESC);

-- Enable RLS
ALTER TABLE public.rank_history ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only read their own rank history
CREATE POLICY "Users can read own rank history"
    ON public.rank_history
    FOR SELECT
    USING (
        puuid IN (
            SELECT sa.puuid
            FROM public.summoner_accounts sa
            WHERE sa.user_id = auth.uid()
        )
    );

-- RLS Policy: Allow insert from authenticated users for their own accounts
CREATE POLICY "Users can insert own rank history"
    ON public.rank_history
    FOR INSERT
    WITH CHECK (
        puuid IN (
            SELECT sa.puuid
            FROM public.summoner_accounts sa
            WHERE sa.user_id = auth.uid()
        )
    );

-- Comment
COMMENT ON TABLE public.rank_history IS 'Stores daily snapshots of player rank for tracking progression over time';
