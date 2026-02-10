-- Migration: Add UPDATE policy for rank_history table (required for UPSERT operations)

-- RLS Policy: Allow update from authenticated users for their own accounts
CREATE POLICY "Users can update own rank history"
    ON public.rank_history
    FOR UPDATE
    USING (
        puuid IN (
            SELECT sa.puuid
            FROM public.summoner_accounts sa
            WHERE sa.user_id = auth.uid()
        )
    )
    WITH CHECK (
        puuid IN (
            SELECT sa.puuid
            FROM public.summoner_accounts sa
            WHERE sa.user_id = auth.uid()
        )
    );

-- Comment
COMMENT ON POLICY "Users can update own rank history" ON public.rank_history IS 'Allows users to update rank history records for their own accounts (required for UPSERT)';
